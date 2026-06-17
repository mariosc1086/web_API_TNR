let ubicaciones = {};

window.onload = async function () {

    const response = await fetch("/ubicaciones");
    ubicaciones = await response.json();

    cargarDepartamentos();
};

function cargarDepartamentos() {

    const depSelect =
        document.getElementById("departamento");

    depSelect.innerHTML = "";

    Object.keys(ubicaciones).forEach(dep => {

        const option =
            document.createElement("option");

        option.value = dep;
        option.text = dep;

        depSelect.appendChild(option);
    });

    cargarProvincias();
}

function cargarProvincias() {

    const dep =
        document.getElementById("departamento").value;

    const provSelect =
        document.getElementById("provincia");

    provSelect.innerHTML = "";

    Object.keys(
        ubicaciones[dep]
    ).forEach(prov => {

        const option =
            document.createElement("option");

        option.value = prov;
        option.text = prov;

        provSelect.appendChild(option);
    });

    cargarDistritos();
}

function cargarDistritos() {

    const dep =
        document.getElementById("departamento").value;

    const prov =
        document.getElementById("provincia").value;

    const distSelect =
        document.getElementById("distrito");

    distSelect.innerHTML = "";

    ubicaciones[dep][prov].forEach(dist => {

        const option =
            document.createElement("option");

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
            headers: {
                "Content-Type": "application/json"
            },
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

        const riesgoTexto = obtenerSemaforo(resultado.nivel_riesgo);

        document.getElementById("riesgo").innerText = riesgoTexto;

        document.getElementById("riesgo").className =
            "metric-value " + claseRiesgo(resultado.nivel_riesgo);

        document.getElementById("clasificacion").innerText =
            resultado.clasificacion === 1 ? "TNR Alta" : "TNR Baja";

        document.getElementById("recomendacion").textContent =
            resultado.recomendacion || "Sin recomendación disponible.";

        construirTabla(resultado.info_conglomerado);
        construirTablaMobile(resultado.info_conglomerado);

    } catch (error) {
        alert("Error al conectar con el servidor: " + error);
    }
}

function construirTabla(info) {

    const tabla = document.getElementById("tabla-info");
    tabla.innerHTML = "";

    if (!info || info.length === 0) {
        tabla.innerHTML = "<tr><td>No hay información disponible</td></tr>";
        return;
    }

    const columnas = Object.keys(info[0]);

    // Columnas que deben mostrarse con decimales
    const columnasDecimales = [
        "TNR Historico por Cong.",
        "TNR Historico por Dist.",
        "TNR Historico por Dep.",
        "Visitas",
        "TEM"
    ];

    let header = "<tr>";

    columnas.forEach(col => {
        header += `<th>${col}</th>`;
    });

    header += "</tr>";

    let filas = "";

    info.forEach(row => {

        filas += "<tr>";

        columnas.forEach(col => {

            let valor = row[col];

            // Solo estas columnas tendrán decimales
            if (
                columnasDecimales.includes(col) &&
                !isNaN(valor) &&
                valor !== "" &&
                valor !== null
            ) {
                valor = Number(valor).toFixed(2);
            }

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

    const columnasPeriodo = datosOrdenados.map(row =>
        `${row["Año"]}`
    );

    const variables = [
        "Meses",
        "TNR Historico por Cong.",
        "TNR Historico por Dist.",
        "TNR Historico por Dep.",
        "Visitas",
        "TEM",
        "N_HOGAR",
        "PromPersHogar",
        "PromMuj12_49",
        "PromMen_12",
        "PromMen_6",
        "PromMen_5",
        "PromMen_3"     
    ];

    const columnasDecimales = [
        "TNR Historico por Cong.",
        "TNR Historico por Dist.",
        "TNR Historico por Dep.",
        "Visitas",
        "TEM",
        "PromPersHogar",
        "PromMuj12_49",
        "PromMen_12",
        "PromMen_6",
        "PromMen_5",
        "PromMen_3"
    ];

    let header = "<tr><th>Variable</th>";

    columnasPeriodo.forEach(periodo => {
        header += `<th>${periodo}</th>`;
    });

    header += "</tr>";

    let filas = "";

    variables.forEach(variable => {

        filas += `<tr><td><strong>${variable}</strong></td>`;

        datosOrdenados.forEach(row => {

            let valor = row[variable];

            if (
                columnasDecimales.includes(variable) &&
                !isNaN(valor) &&
                valor !== "" &&
                valor !== null
            ) {
                valor = Number(valor).toFixed(2);
            }

            filas += `<td>${valor ?? ""}</td>`;
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

function obtenerSemaforo(riesgo) {
    if (riesgo === "Bajo") {
        return "🟢 Bajo";
    }
    if (riesgo === "Medio") {
        return "🟡 Medio";
    }
    if (riesgo === "Alto") {
        return "🟠 Alto";
    }
    if (riesgo === "Crítico") {
        return "🔴 Crítico";
    }
    return riesgo;
}

function claseRiesgo(riesgo) {
    if (riesgo === "Bajo") {
        return "riesgo-bajo";
    }
    if (riesgo === "Medio") {
        return "riesgo-medio";
    }
    if (riesgo === "Alto") {
        return "riesgo-alto";
    }
    if (riesgo === "Crítico") {
        return "riesgo-critico";
    }
    return "";
}   