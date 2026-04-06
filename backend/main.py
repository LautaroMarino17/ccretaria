from dotenv import load_dotenv
load_dotenv()  # debe ejecutarse ANTES de importar cualquier servicio

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import os

from routers import auth, patients, clinical_history, appointments, recording, routines, evaluations
from limiter import limiter

app = FastAPI(
    title="SecretarIA API",
    description="Backend para gestión de pacientes y profesionales de la salud",
    version="1.0.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "SecretarIA API"}
