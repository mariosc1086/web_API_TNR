import joblib
import pandas as pd

# Cargar modelo una sola vez al iniciar
modelo = joblib.load("pipeline_xgb_tnr.pkl")

# Umbral óptimo
THRESHOLD = 0.4292


def clasificar_riesgo(probabilidad: float) -> str:
    if probabilidad < 0.30:
        return "Bajo"
    elif probabilidad < THRESHOLD:
        return "Medio"
    elif probabilidad < 0.70:
        return "Alto"
    else:
        return "Crítico"


def predecir_tnr(datos: dict) -> dict:
    df = pd.DataFrame([{
        "Año": int(datos["Año"]),
        "Meses": datos["Meses"],
        "Departamento": datos["Departamento"],
        "Estratos": datos["Estratos"],
        "Geografico": datos["Geografico"],
        "Visitas": float(datos["Visitas"]),
        "TNR_Historica_Cong": float(datos["TNR_Historica_Cong"]),
        "TNR_Historica_Distrito": float(datos["TNR_Historica_Distrito"]),
        "TNR_Historica_Departamento": float(datos["TNR_Historica_Departamento"]),
        "TEM": float(datos["TEM"]),
        "N_HOGAR": float(datos["N_HOGAR"])
    }])

    probabilidad = modelo.predict_proba(df)[:, 1][0]
    prediccion = int(probabilidad >= THRESHOLD)

    return {
        "probabilidad": round(float(probabilidad), 4),
        "probabilidad_porcentaje": round(float(probabilidad) * 100, 2),
        "clasificacion": prediccion,
        "nivel_riesgo": clasificar_riesgo(float(probabilidad))
    }