from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
from dependencies import get_current_user, require_professional
from services.llm_service import interpret_voice_command

router = APIRouter()


class VoiceCommandRequest(BaseModel):
    text: str
    context: Optional[Dict[str, Any]] = None


@router.post("/interpret")
def interpret_command(body: VoiceCommandRequest, user: dict = Depends(get_current_user)):
    """Interpreta un comando de voz y devuelve acciones + respuesta hablada."""
    require_professional(user)
    return interpret_voice_command(body.text, body.context or {})
