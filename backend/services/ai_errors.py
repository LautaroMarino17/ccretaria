"""
Errores del control de uso de IA.
main.py los convierte en respuestas JSON claras: el usuario nunca ve un error crudo de Groq.
"""
import math


class AIControlError(Exception):
    status_code = 500

    def __init__(self, payload: dict, retry_after: int | None = None):
        super().__init__(payload.get("codigo", ""))
        self.payload = payload
        self.retry_after = retry_after


class CupoAgotado(AIControlError):
    """El profesional llegó a su tope diario o mensual."""
    status_code = 429

    def __init__(self, mensaje: str, renueva: str | None):
        super().__init__({"codigo": "cupo_agotado", "mensaje": mensaje, "renueva": renueva})


class IAPendiente(AIControlError):
    """Groq (o el margen de la cuenta) no permite procesar ahora; el cliente debe reintentar."""
    status_code = 503

    def __init__(self, retry_after: float):
        seconds = max(1, math.ceil(retry_after))
        super().__init__(
            {"codigo": "pendiente", "mensaje": "Procesando, puede demorar.", "reintentar_en": seconds},
            retry_after=seconds,
        )


class TextoDemasiadoLargo(AIControlError):
    """El pedido supera los tokens por minuto de la cuenta: reintentar no sirve."""
    status_code = 422

    def __init__(self):
        super().__init__({
            "codigo": "demasiado_largo",
            "mensaje": "La consulta es demasiado larga para estructurarla automáticamente. "
                       "La transcripción quedó disponible para completarla a mano.",
        })


class IAError(AIControlError):
    """Error no recuperable de Groq (audio inválido, credenciales, etc.)."""
    status_code = 502

    def __init__(self):
        super().__init__({
            "codigo": "error_ia",
            "mensaje": "No pudimos procesar el pedido con la IA. Podés reintentar o completarlo a mano.",
        })
