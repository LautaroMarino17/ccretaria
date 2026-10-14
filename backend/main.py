from dotenv import load_dotenv
load_dotenv()  # debe ejecutarse ANTES de importar cualquier servicio

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import logging
import os

from ai_config import get_ai_config
from routers import auth, patients, clinical_history, appointments, recording, routines, evaluations, voice_command, admin, usage
from services.ai_errors import AIControlError
from limiter import limiter

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
get_ai_config()  # falla al arrancar si falta algún límite de IA en el entorno

app = FastAPI(
    title="SecretarIA API",
    description="Backend para gestión de pacientes y profesionales de la salud",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(AIControlError)
async def ai_control_error_handler(request: Request, exc: AIControlError):
    """Cupo agotado, pendiente, etc.: respuesta clara con código, nunca el error crudo de Groq."""
    headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else None
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.payload}, headers=headers)

_origins = [o.strip() for o in os.getenv("FRONTEND_URL", "http://localhost:4200").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(patients.router, prefix="/patients", tags=["patients"])
app.include_router(clinical_history.router, prefix="/clinical-history", tags=["clinical-history"])
app.include_router(appointments.router, prefix="/appointments", tags=["appointments"])
app.include_router(recording.router, prefix="/recording", tags=["recording"])
app.include_router(routines.router, prefix="/routines", tags=["routines"])
app.include_router(evaluations.router, prefix="/evaluations", tags=["evaluations"])
app.include_router(voice_command.router, prefix="/voice-command", tags=["voice-command"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(usage.router, prefix="/usage", tags=["usage"])


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "SecretarIA API"}
