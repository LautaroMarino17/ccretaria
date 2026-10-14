import logging
from dotenv import load_dotenv

from services import groq_gateway

load_dotenv()

log = logging.getLogger("secretaria.ia")

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


def transcribe_audio_file(audio_bytes: bytes, uid: str, tipo: str) -> str:
    """Transcribe audio usando Whisper via Groq (con control de cupo, ver groq_gateway).
    Archivos >20 MB se dividen en chunks WebM válidos (header + clusters).
    El audio se manda desde memoria: no se escribe en disco."""
    total = len(audio_bytes)

    if total <= MAX_CHUNK_BYTES:
        return groq_gateway.transcribe(uid, tipo, audio_bytes, "audio.webm")

    chunks = _split_webm(audio_bytes, MAX_CHUNK_BYTES)
    log.info("[Whisper] audio grande (%d bytes) dividido en %d chunks", total, len(chunks))
    parts = [groq_gateway.transcribe(uid, tipo, chunk, f"chunk_{i}.webm") for i, chunk in enumerate(chunks)]
    return " ".join(p for p in parts if p)
