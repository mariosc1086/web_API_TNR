from contextlib import asynccontextmanager
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from prediccion import predecir_tnr


BASE_DIR = Path(__file__).resolve().parent
RUTA_DATOS = BASE_DIR / "data_tnr_final.csv"
RUTA_STATIC = BASE_DIR / "static"
RUTA_TEMPLATES = BASE_DIR / "templates"


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Cargando base de datos...")

    data = pd.read_csv(RUTA_DATOS)

    columnas_texto = [
        "Departamento",
        "Provincia",
        "Distrito",
        "Conglomerado"
    ]

    for columna in columnas_texto:
        data[columna] = data[columna].astype(str).str.strip()

    app.state.data = data

    print(
        f"Base cargada correctamente: "
        f"{len(data):,} registros"
    )

    yield

    print("Cerrando SIAT-TNR...")


app = FastAPI(
    title="SIAT-TNR",
    lifespan=lifespan
)

app.mount(
    "/static",
    StaticFiles(directory=str(RUTA_STATIC)),
    name="static"
)

templates = Jinja2Templates(
    directory=str(RUTA_TEMPLATES)
)

def construir_datos_modelo(fila: pd.Series) -> dict:
    return {
        "Año": int(fila["Año"]),
        "Meses": fila["Meses"],
        "Departamento": fila["Departamento"],
        "Estratos": fila["Estratos"],
        "Geografico": fila["Geografico"],
        "Visitas": float(fila["Visitas"]),
        "Altitud": float(fila["Altitud"]),
        "TNR_Historica_Cong": float(fila["TNR_Historica_Cong"]),
        "TNR_Historica_Distrito": float(
            fila["TNR_Historica_Distrito"]
        ),
        "TNR_Historica_Departamento": float(
            fila["TNR_Historica_Departamento"]
        ),
        "TEM": float(fila["TEM"]),
        "N_HOGAR": float(fila["N_HOGAR"]),
        "DuracionPromedio": float(fila["DuracionPromedio"])
    }

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
        data = request.app.state.data
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

        orden_meses = {
            "Enero": 1,
            "Febrero": 2,
            "Marzo": 3,
            "Abril": 4,
            "Mayo": 5,
            "Junio": 6,
            "Julio": 7,
            "Agosto": 8,
            "Septiembre": 9,
            "Octubre": 10,
            "Noviembre": 11,
            "Diciembre": 12
        }

        # Ordenar todos los registros encontrados
        filtro_ordenado = filtro.assign(
            NumeroMes=filtro["Meses"].map(orden_meses)
        ).sort_values(
            ["Año", "NumeroMes"]
        )

        # Tomar el registro más reciente solo para la predicción
        fila = filtro_ordenado.tail(1).iloc[0]

        datos_modelo = construir_datos_modelo(fila)

        resultado = predecir_tnr(datos_modelo)

        # Se agrego esta parte de aqui
        latitud = None if pd.isna(fila["Latitud"]) else float(fila["Latitud"])
        longitud = None if pd.isna(fila["Longitud"]) else float(fila["Longitud"])

        resultado["ubicacion"] = {
            "latitud": latitud,
            "longitud": longitud,
            "departamento": str(fila["Departamento"]),
            "provincia": str(fila["Provincia"]),
            "distrito": str(fila["Distrito"]),
            "conglomerado": str(fila["Conglomerado"])
        }
        # Hasta esta parte de aqui

        # ============================================================
        # CONGLOMERADOS DEL MISMO DISTRITO
        # ============================================================

        filtro_distrito = data[
            (data["Departamento"].str.strip() == departamento) &
            (data["Provincia"].str.strip() == provincia) &
            (data["Distrito"].str.strip() == distrito)
        ].copy()

        filtro_distrito["NumeroMes"] = (
            filtro_distrito["Meses"]
            .map(orden_meses)
            .fillna(0)
        )

        # Orden cronológico y selección del registro más reciente
        # de cada conglomerado
        ultimos_conglomerados = (
            filtro_distrito
            .sort_values(
                ["Conglomerado", "Año", "NumeroMes"]
            )
            .groupby(
                "Conglomerado",
                as_index=False
            )
            .tail(1)
        )

        conglomerados_distrito = []

        for _, fila_distrito in ultimos_conglomerados.iterrows():

            lat = fila_distrito.get("Latitud")
            lon = fila_distrito.get("Longitud")

            # No enviar conglomerados sin coordenadas válidas
            if pd.isna(lat) or pd.isna(lon):
                continue

            try:
                datos_otro = construir_datos_modelo(
                    fila_distrito
                )

                prediccion_otro = predecir_tnr(
                    datos_otro
                )

                conglomerados_distrito.append({
                    "conglomerado": str(
                        fila_distrito["Conglomerado"]
                    ).strip(),
                    "departamento": str(
                        fila_distrito["Departamento"]
                    ).strip(),
                    "provincia": str(
                        fila_distrito["Provincia"]
                    ).strip(),
                    "distrito": str(
                        fila_distrito["Distrito"]
                    ).strip(),
                    "latitud": float(lat),
                    "longitud": float(lon),
                    "probabilidad_porcentaje": (
                        prediccion_otro[
                            "probabilidad_porcentaje"
                        ]
                    ),
                    "nivel_riesgo": prediccion_otro[
                        "nivel_riesgo"
                    ],
                    "consultado": (
                        str(
                            fila_distrito["Conglomerado"]
                        ).strip()
                        == conglomerado
                    )
                })

            except (ValueError, TypeError, KeyError):
                # Evita que un registro defectuoso impida
                # mostrar todo el resultado
                continue

        resultado["conglomerados_distrito"] = (
            conglomerados_distrito
        )

        ## Hasta aqui ##

        if "recomendacion" not in resultado:
            riesgo = resultado.get("nivel_riesgo", "")

            recomendaciones = {
                "Bajo": "Continuar con el monitoreo regular del conglomerado. No se requiere intervención adicional.",
                "Medio": "Revisar el avance del conglomerado y monitorear posibles ausencias, rechazos o incremento de visitas.",
                "Alto": "Priorizar seguimiento del supervisor, reprogramar visitas en horarios alternativos y verificar causas de no respuesta.",
                "Crítico": "Activar intervención inmediata: supervisión directa, refuerzo operativo y estrategia de recuperación del conglomerado."
            }

            resultado["recomendacion"] = recomendaciones.get(
                riesgo,
                "Sin recomendación disponible."
            )

        info_conglomerado = filtro_ordenado.rename(columns={
            "TNR_Historica_Cong": "TNR Historico por Cong.",
            "TNR_Historica_Distrito": "TNR Historico por Dist.",
            "TNR_Historica_Departamento": "TNR Historico por Dep."
        }).to_dict(orient="records")

        # Convertir valores raros de pandas/numpy a texto/número simple
        info_conglomerado = [
            {
                k: str(v) if pd.isna(v) else v
                for k, v in fila.items()
            }
            for fila in info_conglomerado
        ]   

        resultado["info_conglomerado"] = info_conglomerado
        resultado["variables_modelo"] = datos_modelo

        return JSONResponse(content=resultado)

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.get("/ubicaciones")
def obtener_ubicaciones(request: Request):

    data = request.app.state.data
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

            estructura[dep][prov] = sorted(
                distritos.tolist()
            )

    return estructura