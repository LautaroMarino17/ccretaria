import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    return _client


CLINICAL_HISTORY_PROMPT = """Actuás como un asistente especializado en estructurar conversaciones clínicas en formato de ficha médica.

Vas a recibir la transcripción de una consulta médica. El texto proviene de audio y puede tener errores. Interpretá el contenido, corregí la redacción sin alterar la información, y completá los campos según el modelo de historia clínica estándar.

Devolvé ÚNICAMENTE un JSON con esta estructura exacta (sin texto adicional, sin markdown):

{
  "nombre_paciente": "",
  "motivo_consulta": "",
  "antecedentes_sintomas": "",
  "examen_fisico": "",
  "exploracion_estatica": "",
  "exploracion_dinamica": "",
  "signos_vitales": {
    "tension_arterial": "",
    "frecuencia_cardiaca": "",
    "temperatura": "",
    "peso": "",
    "talla": "",
    "saturacion": ""
  },
  "diagnostico": "",
  "plan_terapeutico": "",
  "estudios_complementarios": "",
  "laboratorio": "",
  "medicacion": "",
  "observaciones": "",
  "plantillas": false,
  "descripcion_pedografia": ""
}

Descripción de cada campo:
- nombre_paciente: nombre y apellido del paciente si se menciona.
- motivo_consulta: razón principal de la consulta, en una o dos oraciones.
- antecedentes_sintomas: descripción del cuadro actual, evolución, síntomas referidos, antecedentes personales y familiares relevantes. Incluir todo en un solo bloque redactado.
- examen_fisico: hallazgos generales del examen físico y exploración clínica.
- exploracion_estatica: evaluación postural estática (de frente y perfil), alineación, simetría, postura global si se menciona.
- exploracion_dinamica: observación de la marcha, patrones de movimiento, compensaciones dinámicas si se mencionan.
- signos_vitales: valores numéricos de tensión arterial, frecuencia cardíaca, temperatura, peso, talla y saturación de oxígeno.
- diagnostico: diagnóstico o diagnósticos presuntivos / definitivos.
- plan_terapeutico: indicaciones terapéuticas, ejercicios, rehabilitación, recomendaciones de conducta.
- estudios_complementarios: estudios por imágenes u otros estudios solicitados.
- laboratorio: análisis de laboratorio solicitados o con resultados mencionados.
- medicacion: fármacos indicados con dosis y frecuencia si se mencionan.
- observaciones: SOLO información mencionada en la consulta que no encaja en ningún otro campo específico. No incluir datos no relacionados con la consulta, no inventar, no inferir.
- plantillas: true si el profesional indica o prescribe el uso de plantillas (ortesis plantares, plantillas ortopédicas), false en caso contrario.
- descripcion_pedografia: descripción de la plantilla indicada si se mencionan características específicas (tipo, zona de apoyo, material, etc.), solo si plantillas es true.

Reglas:
- NO inventes información.
- Si un dato no está presente, dejá el campo como "".
- Las maniobras semiológicas NO se incluyen en este JSON (se registran manualmente).
- Usá lenguaje clínico claro y conciso.
- Devolvé ÚNICAMENTE el JSON.

Transcripción:
"""

VOICE_ROUTINE_PROMPT = """Actuás como asistente de fisioterapia que estructura descripciones orales de rutinas en JSON.

El texto proviene de audio y puede tener errores. Interpretá el contenido y estructuralo en el siguiente JSON (sin texto adicional, sin markdown):

{
  "titulo": "",
  "descripcion": "",
  "circuitos": [
    {
      "nombre": "",
      "rondas": "",
      "ejercicios": [
        {
          "nombre": "",
          "enlace": "",
          "reps_seg_mts": "",
          "carga": ""
        }
      ]
    }
  ],
  "observaciones": ""
}

Reglas:
- "circuitos" = bloques/grupos de ejercicios
- "rondas" = número de veces que se repite el bloque (ej: "3")
- "reps_seg_mts" = repeticiones, segundos o metros (ej: "3x12", "30 seg")
- "carga" = peso, porcentaje, nivel de banda, etc.
- Si no hay bloques definidos, poné todos en un único circuito
- Respetá todos los ejercicios mencionados sin agregar ni omitir
- Si algo no está claro, dejá el campo vacío
- Devolvé ÚNICAMENTE el JSON

Transcripción:
"""


ROUTINE_PROMPT = """Actuás como un profesional de la salud que diseña planes de ejercicios personalizados.

Basándote en la información del paciente, generá un plan en JSON con esta estructura exacta (sin texto adicional, sin markdown):

{
  "titulo": "",
  "descripcion": "",
  "ejercicios": [
    {
      "nombre": "",
      "descripcion": "",
      "series": "",
      "repeticiones": "",
      "duracion": "",
      "frecuencia": ""
    }
  ],
  "observaciones": ""
}

Información del paciente:
"""


def _parse_json(raw: str) -> dict:
    cleaned = raw.strip()
    if "```" in cleaned:
        parts = cleaned.split("```")
        for p in parts:
            p = p.strip()
            if p.startswith("json"):
                p = p[4:].strip()
            if p.startswith("{"):
                cleaned = p
                break
    return json.loads(cleaned)


def structure_clinical_history(transcription: str) -> dict:
    print("[Groq LLM] Estructurando historia clínica...")
    response = _get_client().chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "user", "content": CLINICAL_HISTORY_PROMPT + transcription}
        ],
        temperature=0.2,
        max_tokens=2048,
    )
    raw = response.choices[0].message.content
    print("[Groq LLM] OK")
    try:
        return _parse_json(raw)
    except json.JSONDecodeError:
        return {
            "nombre_paciente": "", "motivo_consulta": "", "antecedentes_sintomas": "",
            "examen_fisico": "", "exploracion_estatica": "", "exploracion_dinamica": "",
            "signos_vitales": {
                "tension_arterial": "", "frecuencia_cardiaca": "",
                "temperatura": "", "peso": "", "talla": "", "saturacion": ""
            },
            "diagnostico": "", "plan_terapeutico": "",
            "estudios_complementarios": "", "laboratorio": "",
            "medicacion": "", "observaciones": raw, "plantillas": False,
            "descripcion_pedografia": ""
        }


def structure_routine_from_voice(transcription: str) -> dict:
    print("[Groq LLM] Estructurando rutina desde voz...")
    response = _get_client().chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": VOICE_ROUTINE_PROMPT + transcription}],
        temperature=0.1,
        max_tokens=2048,
    )
    raw = response.choices[0].message.content
    print("[Groq LLM] OK")
    try:
        return _parse_json(raw)
    except json.JSONDecodeError:
        return {
            "titulo": "Rutina",
            "descripcion": "",
            "circuitos": [{"nombre": "Bloque 1", "rondas": "", "ejercicios": []}],
            "observaciones": raw
        }


VOICE_COMMAND_PROMPT = """Sos un asistente de voz para una app médica llamada SecretarIA.
Interpretá comandos de voz del profesional y convertílos en acciones de la app.

Acciones disponibles:
- navegar_pacientes: ir a la lista de pacientes
- navegar_evaluaciones: ir a evaluaciones globales
- navegar_turnos: ir a turnos
- navegar_inicio: ir al inicio
- buscar_y_abrir_paciente: abrir perfil de un paciente (params: { "nombre": "texto a buscar" })
- crear_paciente: crear paciente nuevo (params: { "nombre": "...", "apellido": "..." })
- iniciar_consulta: ir a grabar una nueva consulta/historia clínica de un paciente (params: { "nombre": "texto a buscar" })
- crear_rutina_voz: ir a rutinas de un paciente para crear una con voz (params: { "nombre": "texto a buscar" })
- crear_evaluacion: crear una evaluación completa con todos sus datos (params: ver estructura abajo)
- ninguna: sin acción, solo responder

Estructura de params para crear_evaluacion:
{
  "patient_name": "Apellido, Nombre del paciente mencionado",
  "nombre": "nombre de la evaluación",
  "fecha": "fecha en formato YYYY-MM-DD, si dicen hoy usar fecha actual",
  "observaciones": "observaciones si las mencionan",
  "medidas": [
    Para tipo simple: { "nombre": "", "unidad": "", "tipo": "simple", "intentos": ["valor1", "valor2"] }
    Para tipo asimetría: { "nombre": "", "unidad": "", "tipo": "asimetria", "nombre_a": "lado A", "nombre_b": "lado B", "intentos_a": ["valor1"], "intentos_b": ["valor1"] }
    Para tipo relación: { "nombre": "", "unidad": "", "tipo": "relacion", "nombre_a": "agonista", "nombre_b": "antagonista", "intentos_a": ["valor1"], "intentos_b": ["valor1"] }
  ]
}

Respondé ÚNICAMENTE con un JSON válido (sin markdown):
{
  "acciones": [
    { "tipo": "...", "params": {} }
  ],
  "respuesta": "texto breve en español que se leerá en voz alta"
}

Reglas:
- "respuesta" siempre en español rioplatense, primera persona, máximo 2 oraciones
- Si no entendés el comando, acción "ninguna" y pedí que repitan
- Podés devolver múltiples acciones en orden
- Preservá nombres propios tal como los escuchaste
- En crear_evaluacion, la fecha de hoy es: {TODAY}
- Si el comando es ambiguo, ejecutá la acción más probable y aclaralo en "respuesta"
"""


def interpret_voice_command(text: str) -> dict:
    from datetime import date
    print(f"[Groq LLM] Interpretando comando de voz: {text}")
    prompt = VOICE_COMMAND_PROMPT.replace("{TODAY}", date.today().isoformat())
    response = _get_client().chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt + f"\nComando: {text}"}],
        temperature=0.1,
        max_tokens=1024,
    )
    raw = response.choices[0].message.content
    print("[Groq LLM] OK")
    try:
        return _parse_json(raw)
    except Exception:
        return {
            "acciones": [{"tipo": "ninguna", "params": {}}],
            "respuesta": "No pude interpretar el comando, ¿podés repetirlo?"
        }


def generate_routine(patient_info: dict) -> dict:
    print("[Groq LLM] Generando rutina...")
    info_str = json.dumps(patient_info, ensure_ascii=False, indent=2)
    response = _get_client().chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "user", "content": ROUTINE_PROMPT + info_str}
        ],
        temperature=0.3,
        max_tokens=2048,
    )
    raw = response.choices[0].message.content
    print("[Groq LLM] OK")
    try:
        return _parse_json(raw)
    except json.JSONDecodeError:
        return {"titulo": "Plan generado", "observaciones": raw, "ejercicios": []}
