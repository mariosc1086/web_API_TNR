console.log("script.js actualizado");
console.log("Leaflet disponible:", typeof L);

let ubicaciones = {};
let mapa = null;
let marcadorConglomerado = null;
let capaConglomeradosDistrito = null;

window.onload = async function () {
    const response = await fetch("/ubicaciones");
    ubicaciones = await response.json();
    cargarDepartamentos();
};

function cargarDepartamentos() {
    const depSelect = document.getElementById("departamento");
    depSelect.innerHTML = "";

    Object.keys(ubicaciones).forEach(dep => {
        const option = document.createElement("option");
        option.value = dep;
        option.text = dep;
        depSelect.appendChild(option);
    });

    cargarProvincias();
}

function cargarProvincias() {
    const dep = document.getElementById("departamento").value;
    const provSelect = document.getElementById("provincia");
    provSelect.innerHTML = "";

    Object.keys(ubicaciones[dep]).forEach(prov => {
        const option = document.createElement("option");
        option.value = prov;
        option.text = prov;
        provSelect.appendChild(option);
    });

    cargarDistritos();
}

function cargarDistritos() {
    const dep = document.getElementById("departamento").value;
    const prov = document.getElementById("provincia").value;
    const distSelect = document.getElementById("distrito");

    distSelect.innerHTML = "";

    ubicaciones[dep][prov].forEach(dist => {
        const option = document.createElement("option");
        option.value = dist;
        option.text = dist;
        distSelect.appendChild(option);
    });
}

async function calcularProbabilidad() {

    const departamento = document.getElementById("departamento").value.trim();
    const provincia = document.getElementById("provincia").value.trim();
    const distrito = document.getElementById("distrito").value.trim();
    const conglomerado = document.getElementById("conglomerado").value.trim();

    if (!departamento || !provincia || !distrito || !conglomerado) {
        alert("Completa Departamento, Provincia, Distrito y Conglomerado.");
        return;
    }

    const datosConsulta = {
        Departamento: departamento,
        Provincia: provincia,
        Distrito: distrito,
        Conglomerado: conglomerado
    };

    try {
        const response = await fetch("/predict_conglomerado", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(datosConsulta)
        });

        const resultado = await response.json();

        if (!response.ok) {
            alert(resultado.error);
            return;
        }

        document.getElementById("resultado").classList.remove("oculto");

        document.getElementById("probabilidad").innerText =
            `${Number(resultado.probabilidad_porcentaje).toFixed(2)}%`;

        document.getElementById("riesgo").innerText =
            obtenerSemaforo(resultado.nivel_riesgo);

        document.getElementById("riesgo").className =
            "metric-value " + claseRiesgo(resultado.nivel_riesgo);

        document.getElementById("clasificacion").innerText =
            resultado.clasificacion === 1 ? "TNR Alta" : "TNR No Alta";

        document.getElementById("recomendacion").innerText =
            resultado.recomendacion || "Sin recomendación disponible.";

        construirTabla(resultado.info_conglomerado);
        construirTablaMobile(resultado.info_conglomerado);
        mostrarMapa(resultado);

    } catch (error) {
        alert("Error al conectar con el servidor: " + error);
    }
}

function obtenerColorRiesgo(riesgo) {
    if (riesgo === "Bajo") return "#16a34a";
    if (riesgo === "Medio") return "#ca8a04";
    if (riesgo === "Alto") return "#f97316";
    if (riesgo === "Crítico") return "#dc143c";

    return "#2563eb";
}

function crearIconoRiesgo(riesgo) {
    const color = obtenerColorRiesgo(riesgo);

    return L.divIcon({
        className: "marcador-riesgo-contenedor",
        html: `
            <div
                class="marcador-riesgo"
                style="background-color: ${color};"
                title="Riesgo ${escaparHtml(riesgo)}"
            >
                <div class="marcador-riesgo-centro"></div>
            </div>
        `,
        iconSize: [34, 44],
        iconAnchor: [17, 44],
        popupAnchor: [0, -42]
    });
}

function mostrarConglomeradosDistrito(resultado, mapaActual) {
    const conglomerados =
        resultado.conglomerados_distrito || [];

    capaConglomeradosDistrito.clearLayers();

    const limites = [];

    conglomerados.forEach(item => {
        const latitud = Number(item.latitud);
        const longitud = Number(item.longitud);

        if (
            !Number.isFinite(latitud) ||
            !Number.isFinite(longitud)
        ) {
            return;
        }

        limites.push([latitud, longitud]);

        // El conglomerado consultado se dibuja como pin grande
        if (item.consultado) {
            return;
        }

        const color = obtenerColorRiesgo(
            item.nivel_riesgo
        );

        const marcador = L.circleMarker(
            [latitud, longitud],
            {
                radius: 8,
                color: "#ffffff",
                weight: 2,
                fillColor: color,
                fillOpacity: 0.95
            }
        );

        marcador.bindPopup(`
            <div class="popup-conglomerado">
                <strong>Conglomerado:</strong>
                ${escaparHtml(item.conglomerado)}
                <br>

                <strong>Distrito:</strong>
                ${escaparHtml(item.distrito)}
                <br>

                <strong>Probabilidad:</strong>
                ${Number(
                    item.probabilidad_porcentaje
                ).toFixed(2)}%
                <br>

                <strong>Nivel de riesgo:</strong>
                <span
                    style="
                        color:${color};
                        font-weight:800;
                    "
                >
                    ${escaparHtml(item.nivel_riesgo)}
                </span>
            </div>
        `);

        marcador.addTo(
            capaConglomeradosDistrito
        );
    });

    return limites;
}

function mostrarMapa(resultado) {
    const ubicacion = resultado.ubicacion;

    if (!ubicacion) {
        console.error("La respuesta no contiene ubicación");
        return;
    }

    const latitud = Number(ubicacion.latitud);
    const longitud = Number(ubicacion.longitud);

    if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) {
        console.error("Las coordenadas no son válidas");
        return;
    }

    const contenedor = document.getElementById("mapa");

    if (!contenedor) {
        console.error("No existe el contenedor del mapa");
        return;
    }

    if (mapa !== null) {
        mapa.remove();
        mapa = null;
    }

    mapa = L.map("mapa", {
        fullscreenControl: true,
        fullscreenControlOptions: {
            position: "topleft",
            title: "Pantalla completa",
            titleCancel: "Salir de pantalla completa"
        }
    }).setView(
        [latitud, longitud],
        15
    );

    const capaCalles = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }
    );

    const capaSatelite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/" +
        "World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
            maxZoom: 19,
            attribution:
                "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
        }
    );

    capaCalles.addTo(mapa);

    capaConglomeradosDistrito = L.layerGroup().addTo(mapa);

    const capasBase = {
        "🗺️ Mapa de calles": capaCalles,
        "🛰️ Vista satelital": capaSatelite
    };

    const capasSuperpuestas = {
        "📍 Conglomerados del distrito":
            capaConglomeradosDistrito
    };

    L.control.layers(
        capasBase,
        capasSuperpuestas,
        {
            position: "topright",
            collapsed: false
        }
    ).addTo(mapa);

    const leyenda = L.control({
    position: "bottomright"
    });

    leyenda.onAdd = function () {
        const div = L.DomUtil.create(
            "div",
            "leyenda-riesgo"
        );

        div.innerHTML = `
            <div class="leyenda-titulo">
                Nivel de riesgo
            </div>

            <div>
                <span style="background:#16a34a;"></span>
                Bajo
            </div>

            <div>
                <span style="background:#ca8a04;"></span>
                Medio
            </div>

            <div>
                <span style="background:#f97316;"></span>
                Alto
            </div>

            <div>
                <span style="background:#dc143c;"></span>
                Crítico
            </div>
        `;

        return div;
    };

    leyenda.addTo(mapa);

    const limitesDistrito =
        mostrarConglomeradosDistrito(
            resultado,
            mapa
        );

    const iconoRiesgo = crearIconoRiesgo(
    resultado.nivel_riesgo
    );

    marcadorConglomerado = L.marker(
        [latitud, longitud],
        {
            icon: iconoRiesgo,
            title: `Conglomerado ${ubicacion.conglomerado}`,
            zIndexOffset: 1000
        }
    ).addTo(mapa);

    L.circle(
        [latitud, longitud],
        {
            radius: 90,
            color: obtenerColorRiesgo(
                resultado.nivel_riesgo
            ),
            weight: 2,
            fillColor: obtenerColorRiesgo(
                resultado.nivel_riesgo
            ),
            fillOpacity: 0.12
        }
    ).addTo(capaConglomeradosDistrito);

    marcadorConglomerado
    .bindPopup(`
        <div class="popup-conglomerado">
            <strong>Conglomerado:</strong>
            ${escaparHtml(ubicacion.conglomerado)}
            <br>

            <strong>Departamento:</strong>
            ${escaparHtml(ubicacion.departamento)}
            <br>

            <strong>Provincia:</strong>
            ${escaparHtml(ubicacion.provincia)}
            <br>

            <strong>Distrito:</strong>
            ${escaparHtml(ubicacion.distrito)}
            <br>

            <strong>Probabilidad:</strong>
            ${Number(resultado.probabilidad_porcentaje).toFixed(2)}%
            <br>

            <strong>Nivel de riesgo:</strong>
            <span
                class="popup-riesgo"
                style="
                    color: ${obtenerColorRiesgo(resultado.nivel_riesgo)};
                "
            >
                ${escaparHtml(resultado.nivel_riesgo)}
            </span>
        </div>
    `)
    .openPopup();

    if (
        !limitesDistrito.some(
            punto =>
                punto[0] === latitud &&
                punto[1] === longitud
        )
    ) {
        limitesDistrito.push(
            [latitud, longitud]
        );
    }

    if (limitesDistrito.length > 1) {
        mapa.fitBounds(
            limitesDistrito,
            {
                padding: [35, 35],
                maxZoom: 16
            }
        );
    } else {
        mapa.setView(
            [latitud, longitud],
            15
        );
    }

    setTimeout(() => {
        mapa.invalidateSize(true);
    }, 300);
}

function escaparHtml(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function obtenerSemaforo(riesgo) {
    if (riesgo === "Bajo") return "🟢 Bajo";
    if (riesgo === "Medio") return "🟡 Medio";
    if (riesgo === "Alto") return "🟠 Alto";
    if (riesgo === "Crítico") return "🔴 Crítico";
    return riesgo;
}

function claseRiesgo(riesgo) {
    if (riesgo === "Bajo") return "riesgo-bajo";
    if (riesgo === "Medio") return "riesgo-medio";
    if (riesgo === "Alto") return "riesgo-alto";
    if (riesgo === "Crítico") return "riesgo-critico";
    return "";
}

const variablesTabla = [
    { etiqueta: "Año", campo: "Año" },
    { etiqueta: "Mes", campo: "Meses" },
    { etiqueta: "Departamento", campo: "Departamento" },
    { etiqueta: "Provincia", campo: "Provincia" },
    { etiqueta: "Distrito", campo: "Distrito" },
    { etiqueta: "Dominio Geográfico", campo: "Geografico" },
    { etiqueta: "Estrato SE", campo: "Estratos" },
    { etiqueta: "Conglomerado", campo: "Conglomerado" },
    { etiqueta: "Altitud (msnm)", campo: "Altitud" },
    { etiqueta: "Latitud", campo: "Latitud" },
    { etiqueta: "Longitud", campo: "Longitud" },
    { etiqueta: "TNR Histórico por Cong.", campo: "TNR Historico por Cong." },
    { etiqueta: "TNR Histórico por Dist.", campo: "TNR Historico por Dist." },
    { etiqueta: "TNR Histórico por Dep.", campo: "TNR Historico por Dep." },
    { etiqueta: "Promedio de Visitas", campo: "Visitas" },
    { etiqueta: "Tasa de Error de Marco", campo: "TEM" },
    { etiqueta: "Número de Hogares", campo: "N_HOGAR" },
    { etiqueta: "Total de Personas en el Hogar", campo: "TotalPersHogar" },
    { etiqueta: "Total de Mujeres entre 12 a 49", campo: "TotalMuj12_49" },
    { etiqueta: "Total de menores < 12", campo: "TotalMen_12" },
    { etiqueta: "Total de menores < 6", campo: "TotalMen_6" },
    { etiqueta: "Total de menores < 5", campo: "TotalMen_5" },
    { etiqueta: "Total de menores < 3", campo: "TotalMen_3" },
    { etiqueta: "Duración promedio de la entrevista", campo: "DuracionPromedio" },
    { etiqueta: "Tasa de No Respuesta", campo: "TNR" }
];

const columnasDecimales = [
    "TNR Historico por Cong.",
    "TNR Historico por Dist.",
    "TNR Historico por Dep.",
    "Visitas",
    "TEM",
    "TotalPersHogar",
    "TotalMuj12_49",
    "TotalMen_12",
    "TotalMen_6",
    "TotalMen_5",
    "TotalMen_3",
    "DuracionPromedio",
    "Latitud",
    "Longitud",
    "TNR"
];

function formatearValor(campo, valor) {
    if (
        columnasDecimales.includes(campo) &&
        !isNaN(valor) &&
        valor !== "" &&
        valor !== null
    ) {
        return Number(valor).toFixed(2);
    }
    return valor ?? "";
}

function construirTabla(info) {

    const tabla = document.getElementById("tabla-info");
    tabla.innerHTML = "";

    if (!info || info.length === 0) {
        tabla.innerHTML = "<tr><td>No hay información disponible</td></tr>";
        return;
    }

    let header = "<tr>";
    variablesTabla.forEach(item => {
        header += `<th>${item.etiqueta}</th>`;
    });
    header += "</tr>";

    let filas = "";

    info.forEach(row => {
        filas += "<tr>";

        variablesTabla.forEach(item => {
            const valor = formatearValor(item.campo, row[item.campo]);
            filas += `<td>${valor}</td>`;
        });

        filas += "</tr>";
    });

    tabla.innerHTML = header + filas;
}

function construirTablaMobile(info) {

    const tabla = document.getElementById("tabla-info-mobile");
    tabla.innerHTML = "";

    if (!info || info.length === 0) {
        tabla.innerHTML = "<tr><td>No hay información disponible</td></tr>";
        return;
    }

    const ordenMeses = {
        "ene": 1, "feb": 2, "mar": 3, "abr": 4,
        "may": 5, "jun": 6, "jul": 7, "ago": 8,
        "sep": 9, "oct": 10, "nov": 11, "dic": 12
    };

    const datosOrdenados = [...info].sort((a, b) => {
        if (Number(a["Año"]) !== Number(b["Año"])) {
            return Number(a["Año"]) - Number(b["Año"]);
        }
        return ordenMeses[a["Meses"]] - ordenMeses[b["Meses"]];
    });

    const columnasPeriodo = datosOrdenados.map(row => `${row["Año"]}`);

    const variablesMobile = [
        { etiqueta: "Mes", campo: "Meses" },
        { etiqueta: "Departamento", campo: "Departamento" },
        { etiqueta: "Provincia", campo: "Provincia" },
        { etiqueta: "Distrito", campo: "Distrito" },
        { etiqueta: "Dominio Geográfico", campo: "Geografico" },
        { etiqueta: "Estrato SE", campo: "Estratos" },
        { etiqueta: "Conglomerado", campo: "Conglomerado" },
        { etiqueta: "Altitud (msnm)", campo: "Altitud" },
        { etiqueta: "Latitud", campo: "Latitud" },
        { etiqueta: "Longitud", campo: "Longitud" },
        { etiqueta: "TNR Histórico por Cong.", campo: "TNR Historico por Cong." },
        { etiqueta: "TNR Histórico por Dist.", campo: "TNR Historico por Dist." },
        { etiqueta: "TNR Histórico por Dep.", campo: "TNR Historico por Dep." },
        { etiqueta: "Promedio de Visitas", campo: "Visitas" },
        { etiqueta: "Tasa de Error de Marco", campo: "TEM" },
        { etiqueta: "Número de Hogares", campo: "N_HOGAR" },
        { etiqueta: "Total de Personas en el Hogar", campo: "TotalPersHogar" },
        { etiqueta: "Total de Mujeres entre 12 a 49", campo: "TotalMuj12_49" },
        { etiqueta: "Total de menores < 12", campo: "TotalMen_12" },
        { etiqueta: "Total de menores < 6", campo: "TotalMen_6" },
        { etiqueta: "Total de menores < 5", campo: "TotalMen_5" },
        { etiqueta: "Total de menores < 3", campo: "TotalMen_3" },
        { etiqueta: "Duración promedio de la entrevista", campo: "DuracionPromedio" },
        { etiqueta: "Tasa de No Respuesta", campo: "TNR" }
    ];

    let header = "<tr><th>Variable</th>";
    columnasPeriodo.forEach(periodo => {
        header += `<th>${periodo}</th>`;
    });
    header += "</tr>";

    let filas = "";

    variablesMobile.forEach(item => {
        filas += `<tr><td><strong>${item.etiqueta}</strong></td>`;

        datosOrdenados.forEach(row => {
            const valor = formatearValor(item.campo, row[item.campo]);
            filas += `<td>${valor}</td>`;
        });

        filas += "</tr>";
    });

    tabla.innerHTML = header + filas;
}

document.addEventListener("change", function(e){

    if(e.target.id === "departamento"){
        cargarProvincias();
    }

    if(e.target.id === "provincia"){
        cargarDistritos();
    }

});