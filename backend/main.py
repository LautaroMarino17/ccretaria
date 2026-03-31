from dotenv import load_dotenv
load_dotenv()  # debe ejecutarse ANTES de importar cualquier servicio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from routers import auth, patients, clinical_history, appointments, recording, routines

app = FastAPI(
    title="SecretarIA API",
    description="Backend para gestión de pacientes y profesionales de la salud",
    version="1.0.0"
)

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


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "SecretarIA API"}
