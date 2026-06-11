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

        document.getElementById("riesgo").innerText =
            resultado.nivel_riesgo;

        document.getElementById("riesgo").className =
            "metric-value " + resultado.nivel_riesgo.toLowerCase();

        document.getElementById("clasificacion").innerText =
            resultado.clasificacion === 1 ? "TNR Alta" : "TNR No Alta";

        construirTabla(resultado.info_conglomerado);
        mostrarVariables(resultado.variables_modelo);

    } catch (error) {
        alert("Error al conectar con el servidor: " + error);
    }
}


function construirTabla(info) {

    const tabla = document.getElementById("tabla-info");
    tabla.innerHTML = "";

    const columnas = Object.keys(info);

    let header = "<tr>";
    columnas.forEach(col => {
        header += `<th>${col}</th>`;
    });
    header += "</tr>";

    let fila = "<tr>";
    columnas.forEach(col => {
        fila += `<td>${info[col]}</td>`;
    });
    fila += "</tr>";

    tabla.innerHTML = header + fila;
}


function mostrarVariables(variables) {
    document.getElementById("variables-modelo").innerText =
        JSON.stringify(variables, null, 4);
}