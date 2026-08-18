from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from dependencies import get_current_user, require_professional, require_plan
from services.llm_service import interpret_voice_command
from limiter import limiter

router = APIRouter()


class VoiceCommandRequest(BaseModel):
    text: str
    context: Optional[Dict[str, Any]] = None


@router.post("/interpret")
@limiter.limit("10/minute")
def interpret_command(request: Request, body: VoiceCommandRequest, user: dict = Depends(require_plan(3))):
    """Interpreta un comando de voz y devuelve acciones + respuesta hablada. Requiere Plan 3 (Amalia)."""
    return interpret_voice_command(body.text, body.context or {})
