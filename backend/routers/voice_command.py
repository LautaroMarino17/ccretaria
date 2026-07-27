from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from dependencies import get_current_user, require_professional, require_plan
from services.llm_service import interpret_voice_command

router = APIRouter()


class VoiceCommandRequest(BaseModel):
    text: str
    context: Optional[Dict[str, Any]] = None


@router.post("/interpret")
def interpret_command(body: VoiceCommandRequest, user: dict = Depends(require_plan(3))):
    """Interpreta un comando de voz y devuelve acciones + respuesta hablada. Requiere Plan 3 (Amalia)."""
    return interpret_voice_command(body.text, body.context or {})
