import traceback
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Request
from dependencies import get_current_user, require_professional
from services.transcription_service import transcribe_audio_file
from services.llm_service import structure_clinical_history
from main import limiter

router = APIRouter()


@router.post("/transcribe")
@limiter.limit("10/minute")
async def transcribe(
    request: Request,
    audio: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """
    Recibe un archivo de audio grabado desde el frontend,
    lo transcribe con Whisper y devuelve el texto.
    """
    require_professional(user)

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
        text = transcribe_audio_file(audio_bytes, filename=audio.filename or "audio.webm")
        return {"transcription": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en transcripción: {str(e)}")


@router.post("/structure")
@limiter.limit("10/minute")
async def structure(
    request: Request,
    body: dict,
    user: dict = Depends(get_current_user)
):
    """
    Recibe la transcripción y la estructura en historia clínica usando el LLM.
    """
    require_professional(user)

    transcription = body.get("transcription", "").strip()
    if not transcription:
        raise HTTPException(status_code=400, detail="La transcripción no puede estar vacía")

    try:
        structured = structure_clinical_history(transcription)
        return {"clinical_history": structured}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al estructurar: {str(e)}")


@router.post("/transcribe-and-structure")
@limiter.limit("10/minute")
async def transcribe_and_structure(
    request: Request,
    audio: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """
    Pipeline completo: audio → transcripción → historia clínica estructurada.
    """
    print(f"[RECORDING] Endpoint alcanzado. User: {user.get('uid')} Role: {user.get('role')}")
    require_professional(user)

    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="El archivo de audio está vacío")

    print(f"[RECORDING] Content-Type: {audio.content_type}, Filename: {audio.filename}, Size: {len(audio_bytes)} bytes")

    try:
        print("[RECORDING] Iniciando transcripción...")
        transcription = transcribe_audio_file(audio_bytes, filename=audio.filename or "audio.webm")
        print(f"[RECORDING] Transcripción OK: {repr(transcription[:100])}")

        print("[RECORDING] Estructurando con LLM...")
        structured = structure_clinical_history(transcription)
        print("[RECORDING] LLM OK")

        return {
            "transcription": transcription,
            "clinical_history": structured
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error en el pipeline: {str(e)}")
