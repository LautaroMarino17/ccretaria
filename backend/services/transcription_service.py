import os
import tempfile
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"), max_retries=0)
    return _client


def transcribe_audio_file(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """Transcribe audio usando Whisper large-v3 via Groq API."""
    print(f"[Groq Whisper] Transcribiendo {len(audio_bytes)} bytes...")

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as f:
            result = _get_client().audio.transcriptions.create(
                file=(filename, f, "audio/webm"),
                model="whisper-large-v3",
                language="es",
                response_format="text"
            )
        text = result.strip() if isinstance(result, str) else result.text.strip()
        print(f"[Groq Whisper] OK: {repr(text[:100])}")
        return text
    finally:
        try:
            os.unlink(tmp_path)
        except FileNotFoundError:
            pass
