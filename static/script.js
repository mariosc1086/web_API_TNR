async function calcularRiesgo() {

    const datos = {
        "Año": document.getElementById("anio").value,
        "Meses": document.getElementById("mes").value,
        "Departamento": document.getElementById("departamento").value,
        "Estratos": document.getElementById("estratos").value,
        "Geografico": document.getElementById("geografico").value,
        "Visitas": document.getElementById("visitas").value,
        "TNR_Historica_Cong": document.getElementById("tnr_cong").value,
        "TNR_Historica_Distrito": document.getElementById("tnr_dist").value,
        "TNR_Historica_Departamento": document.getElementById("tnr_dep").value,
        "TEM": document.getElementById("tem").value,
        "N_HOGAR": document.getElementById("n_hogar").value
    };

    try {
        const response = await fetch("/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(datos)
        });

        const resultado = await response.json();

        if (!response.ok) {
            alert("Error: " + resultado.error);
            return;
        }

        document.getElementById("resultado").classList.remove("oculto");

        document.getElementById("probabilidad").innerHTML =
            `<strong>Probabilidad de TNR Alta:</strong> ${resultado.probabilidad_porcentaje}%`;

        document.getElementById("riesgo").innerHTML =
            `<strong>Nivel de riesgo:</strong> <span class="${claseRiesgo(resultado.nivel_riesgo)}">${resultado.nivel_riesgo}</span>`;

        document.getElementById("clasificacion").innerHTML =
            `<strong>Clasificación:</strong> ${resultado.clasificacion === 1 ? "TNR Alta" : "TNR No Alta"}`;

    } catch (error) {
        alert("Error al conectar con el servidor: " + error);
    }
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