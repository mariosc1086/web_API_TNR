import joblib
import pandas as pd

# Cargar modelo una sola vez al iniciar
modelo = joblib.load("pipeline_xgb_tnr.pkl")

# Umbral óptimo
THRESHOLD = 0.429829


def clasificar_riesgo(probabilidad: float) -> str:
    if probabilidad < 0.15:
        return "Bajo"
    elif probabilidad < THRESHOLD:
        return "Medio"
    elif probabilidad < 0.70:
        return "Alto"
    else:
        return "Crítico"

def recomendar_accion(riesgo: str) -> str:
    if riesgo == "Bajo":
        return "Continuar con el monitoreo regular del conglomerado. No se requiere intervención adicional."
    elif riesgo == "Medio":
        return "Revisar el avance del conglomerado y monitorear posibles ausencias, rechazos o incremento de visitas."
    elif riesgo == "Alto":
        return "Priorizar seguimiento del supervisor, reprogramar visitas en horarios alternativos y verificar causas de no respuesta."
    elif riesgo == "Crítico":
        return "Activar intervención inmediata: supervisión directa, refuerzo operativo y estrategia de recuperación del conglomerado."
    return "Sin recomendación disponible."

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
    riesgo = clasificar_riesgo(float(probabilidad))

    return {
        "probabilidad": round(float(probabilidad), 4),
        "probabilidad_porcentaje": round(float(probabilidad) * 100, 2),
        "clasificacion": prediccion,
        "nivel_riesgo": riesgo,
        "recomendacion": recomendar_accion(riesgo)
    }



