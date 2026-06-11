from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from prediccion import predecir_tnr

app = FastAPI(title="SIAT-TNR")

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request}
    )


@app.post("/predict")
async def predict(request: Request):
    try:
        datos = await request.json()

        resultado = predecir_tnr(datos)

        return JSONResponse(content=resultado)

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )