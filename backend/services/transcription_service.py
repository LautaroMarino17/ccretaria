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

# WebM/EBML Cluster element ID — marks the start of each independent audio block
_WEBM_CLUSTER_ID = b'\x1f\x43\xb6\x75'


def _split_webm(data: bytes, max_bytes: int) -> list[bytes]:
    """Split WebM bytes at cluster boundaries, prepending the file header to each chunk.

    WebM files have a fixed header (EBML + Segment Info + Tracks) followed by
    Cluster elements. Chunks 2..N need the header prepended so Whisper can
    decode the codec info — raw cluster bytes alone are not valid WebM files.
    """
    first = data.find(_WEBM_CLUSTER_ID)
    if first == -1:
        return [data]  # can't parse structure, send whole file

    header = data[:first]
    budget = max_bytes - len(header)

    # Collect all cluster start positions + a sentinel at end-of-file
    positions: list[int] = []
    pos = first
    while (idx := data.find(_WEBM_CLUSTER_ID, pos)) != -1:
        positions.append(idx)
        pos = idx + 4
    positions.append(len(data))

    chunks: list[bytes] = []
    i = 0
    while i < len(positions) - 1:
        j = i + 1
        # Advance j while the accumulated clusters fit within budget
        while j < len(positions) - 1 and (positions[j] - positions[i]) <= budget:
            j += 1
        chunks.append(header + data[positions[i]:positions[j]])
        i = j

    return chunks


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
    Archivos >20 MB se dividen en chunks WebM válidos (header + clusters)."""
    total = len(audio_bytes)
    print(f"[Groq Whisper] Transcribiendo {total} bytes...")

    if total <= MAX_CHUNK_BYTES:
        text = _transcribe_chunk(audio_bytes, filename)
        print(f"[Groq Whisper] OK: {repr(text[:100])}")
        return text

    print(f"[Groq Whisper] Audio grande ({total} bytes), dividiendo por clusters WebM...")
    chunks = _split_webm(audio_bytes, MAX_CHUNK_BYTES)
    print(f"[Groq Whisper] {len(chunks)} chunks generados")

    parts: list[str] = []
    for i, chunk in enumerate(chunks):
        print(f"[Groq Whisper] Chunk {i+1}/{len(chunks)} ({len(chunk)} bytes)...")
        part = _transcribe_chunk(chunk, f"chunk_{i}.webm")
        print(f"[Groq Whisper] Chunk {i+1} OK: {repr(part[:60])}")
        parts.append(part)

    full = " ".join(p for p in parts if p)
    print(f"[Groq Whisper] Completo ({len(parts)} chunks): {repr(full[:100])}")
    return full
