from dataclasses import asdict
from fastapi import APIRouter, Depends
from dependencies import get_current_user, require_professional
from services.ai_usage_service import get_quota_status
from services.groq_gateway import get_store

router = APIRouter()


@router.get("/me")
def my_usage(user: dict = Depends(get_current_user)):
    """Estado del cupo de IA del profesional. Toda la lógica está acá; el frontend solo lo muestra."""
    require_professional(user)
    return asdict(get_quota_status(get_store(), user["uid"]))
