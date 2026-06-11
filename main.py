from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import pandas as pd

from prediccion import predecir_tnr

app = FastAPI(title="SIAT-TNR")

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

# Cargar base una sola vez
data = pd.read_csv("data_tnr_final.csv")

# Asegurar tipo texto para búsqueda
data["Departamento"] = data["Departamento"].astype(str)
data["Provincia"] = data["Provincia"].astype(str)
data["Distrito"] = data["Distrito"].astype(str)
data["Conglomerado"] = data["Conglomerado"].astype(str)


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={}
    )


@app.post("/predict_conglomerado")
async def predict_conglomerado(request: Request):
    try:
        consulta = await request.json()

        departamento = str(consulta["Departamento"]).strip()
        provincia = str(consulta["Provincia"]).strip()
        distrito = str(consulta["Distrito"]).strip()
        conglomerado = str(consulta["Conglomerado"]).strip()

        filtro = data[
            (data["Departamento"].str.strip() == departamento) &
            (data["Provincia"].str.strip() == provincia) &
            (data["Distrito"].str.strip() == distrito) &
            (data["Conglomerado"].str.strip() == conglomerado)
        ]

        if filtro.empty:
            return JSONResponse(
                status_code=404,
                content={
                    "error": "No se encontró información para el conglomerado ingresado."
                }
            )

        # Ordenar todos los registros encontrados
        filtro_ordenado = filtro.sort_values(["Año", "Meses"])

        # Tomar el registro más reciente solo para la predicción
        fila = filtro_ordenado.tail(1).iloc[0]

        datos_modelo = {
            "Año": int(fila["Año"]),
            "Meses": fila["Meses"],
            "Departamento": fila["Departamento"],
            "Estratos": fila["Estratos"],
            "Geografico": fila["Geografico"],
            "Visitas": float(fila["Visitas"]),
            "TNR_Historica_Cong": float(fila["TNR_Historica_Cong"]),
            "TNR_Historica_Distrito": float(fila["TNR_Historica_Distrito"]),
            "TNR_Historica_Departamento": float(fila["TNR_Historica_Departamento"]),
            "TEM": float(fila["TEM"]),
            "N_HOGAR": float(fila["N_HOGAR"])
        }

        resultado = predecir_tnr(datos_modelo)

        info_conglomerado = filtro_ordenado.to_dict(orient="records")

        # Convertir valores raros de pandas/numpy a texto/número simple
        info_conglomerado = {
            k: str(v) if pd.isna(v) else v
            for k, v in info_conglomerado.items()
        }

        resultado["info_conglomerado"] = info_conglomerado
        resultado["variables_modelo"] = datos_modelo

        return JSONResponse(content=resultado)

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )
    
@app.get("/ubicaciones")
def obtener_ubicaciones():

    estructura = {}

    for dep in sorted(data["Departamento"].dropna().unique()):

        estructura[dep] = {}

        provincias = data[
            data["Departamento"] == dep
        ]["Provincia"].dropna().unique()

        for prov in sorted(provincias):

            distritos = data[
                (data["Departamento"] == dep) &
                (data["Provincia"] == prov)
            ]["Distrito"].dropna().unique()

            estructura[dep][prov] = sorted(list(distritos))

    return estructura