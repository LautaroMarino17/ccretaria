import logging
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from dependencies import require_plan
from services.ai_errors import AIControlError
from services.groq_gateway import get_store
from services.transcription_service import transcribe_audio_file
from services.llm_service import structure_clinical_history, structure_routine_from_voice
from limiter import limiter

router = APIRouter()
log = logging.getLogger("secretaria.ia")

# Las llamadas a Groq son bloqueantes (y pueden esperar entre reintentos):
# se ejecutan en el threadpool para no frenar el resto del servidor.
# Los AIControlError (cupo agotado, pendiente, etc.) los convierte main.py en respuestas claras.


@router.post("/transcribe")
@limiter.limit("10/minute")
async def transcribe(
    request: Request,
    audio: UploadFile = File(...),
    user: dict = Depends(require_plan(1))
):
    """
    Recibe un archivo de audio grabado desde el frontend,
    lo transcribe con Whisper y devuelve el texto.
    """
    allowed_types = {"audio/webm", "audio/wav", "audio/mp4", "audio/ogg", "audio/mpeg"}
    if audio.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no soportado: {audio.content_type}"
        )

    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="El archivo de audio está vacío")

    try:
        text = await run_in_threadpool(transcribe_audio_file, audio_bytes, user["uid"], "transcripcion")
        return {"transcription": text}
    except AIControlError:
        raise
    except Exception as e:
        log.error("[RECORDING] transcribe: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Error en la transcripción")


@router.post("/structure")
@limiter.limit("10/minute")
async def structure(
    request: Request,
    body: dict,
    user: dict = Depends(require_plan(1))
):
    """
    Recibe la transcripción y la estructura en historia clínica usando el LLM.
    """
    transcription = body.get("transcription", "").strip()
    if not transcription:
        raise HTTPException(status_code=400, detail="La transcripción no puede estar vacía")

    try:
        structured = await run_in_threadpool(structure_clinical_history, transcription, user["uid"])
        return {"clinical_history": structured}
    except AIControlError:
        raise
    except Exception as e:
        log.error("[RECORDING] structure: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Error al estructurar la historia clínica")


@router.post("/transcribe-and-structure")
@limiter.limit("10/minute")
async def transcribe_and_structure(
    request: Request,
    audio: UploadFile = File(...),
    user: dict = Depends(require_plan(1))
):
    """
    Pipeline completo: audio → transcripción → historia clínica estructurada.
    """
    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="El archivo de audio está vacío")

    try:
        transcription = await run_in_threadpool(transcribe_audio_file, audio_bytes, user["uid"], "transcripcion")
        structured = await run_in_threadpool(structure_clinical_history, transcription, user["uid"])
        return {
            "transcription": transcription,
            "clinical_history": structured
        }
    except AIControlError:
        raise
    except Exception as e:
        log.error("[RECORDING] transcribe-and-structure: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Error en el pipeline de transcripción")


@router.post("/transcribe-chunk")
@limiter.limit("60/minute")
async def transcribe_chunk(
    request: Request,
    audio: UploadFile = File(...),
    origen: str = Form("consulta"),
    user: dict = Depends(require_plan(1))
):
    """Transcribe un chunk de audio y devuelve el texto. Sin LLM.
    origen: 'consulta' (grabación de historia clínica) o 'amalia' (comando de voz)."""
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Chunk de audio vacío")
    tipo = "comando_voz" if origen == "amalia" else "transcripcion"
    # Amalia es del Plan 3 (igual que /voice-command/interpret); la grabación de consultas, Plan 1
    if tipo == "comando_voz" and await run_in_threadpool(get_store().get_plan, user["uid"]) < 3:
        raise HTTPException(status_code=403, detail="Esta función requiere el Plan 3 o superior")
    try:
        text = await run_in_threadpool(transcribe_audio_file, audio_bytes, user["uid"], tipo)
        return {"text": text}
    except AIControlError:
        raise
    except Exception as e:
        log.error("[CHUNK] %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Error en la transcripción")


@router.post("/transcribe-routine")
@limiter.limit("10/minute")
async def transcribe_routine(
    request: Request,
    audio: UploadFile = File(...),
    user: dict = Depends(require_plan(2))
):
    """Pipeline: audio → transcripción → rutina estructurada. Requiere Plan 2."""
    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="El archivo de audio está vacío")

    try:
        transcription = await run_in_threadpool(transcribe_audio_file, audio_bytes, user["uid"], "rutina_voz")
        routine = await run_in_threadpool(structure_routine_from_voice, transcription, user["uid"])
        return {"transcription": transcription, "routine": routine}
    except AIControlError:
        raise
    except Exception as e:
        log.error("[RECORDING] transcribe-routine: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Error en el pipeline de transcripción")
