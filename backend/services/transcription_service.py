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


MAX_CHUNK_BYTES = 20 * 1024 * 1024  # 20 MB


def _transcribe_chunk(chunk: bytes, chunk_name: str) -> str:
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(chunk)
        tmp_path = tmp.name
    try:
        with open(tmp_path, "rb") as f:
            result = _get_client().audio.transcriptions.create(
                file=(chunk_name, f, "audio/webm"),
                model="whisper-large-v3",
                language="es",
                response_format="text"
            )
        return result.strip() if isinstance(result, str) else result.text.strip()
    finally:
        try:
            os.unlink(tmp_path)
        except FileNotFoundError:
            pass


def transcribe_audio_file(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """Transcribe audio usando Whisper large-v3 via Groq API.
    Si el audio supera 20 MB lo divide en chunks y concatena las transcripciones."""
    total = len(audio_bytes)
    print(f"[Groq Whisper] Transcribiendo {total} bytes...")

    if total <= MAX_CHUNK_BYTES:
        text = _transcribe_chunk(audio_bytes, filename)
        print(f"[Groq Whisper] OK: {repr(text[:100])}")
        return text

    n_chunks = -(-total // MAX_CHUNK_BYTES)  # ceil division
    chunk_size = total // n_chunks
    print(f"[Groq Whisper] Audio grande ({total} bytes) → {n_chunks} chunks de ~{chunk_size // 1024} KB")

    parts = []
    for i in range(n_chunks):
        start = i * chunk_size
        end = total if i == n_chunks - 1 else start + chunk_size
        chunk = audio_bytes[start:end]
        print(f"[Groq Whisper] Chunk {i+1}/{n_chunks} ({len(chunk)} bytes)...")
        part = _transcribe_chunk(chunk, f"chunk_{i}.webm")
        print(f"[Groq Whisper] Chunk {i+1} OK: {repr(part[:60])}")
        parts.append(part)

    full = " ".join(p for p in parts if p)
    print(f"[Groq Whisper] Transcripción completa ({len(parts)} chunks): {repr(full[:100])}")
    return full
