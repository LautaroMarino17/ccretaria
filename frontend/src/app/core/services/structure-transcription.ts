import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

/**
 * Tamaño máximo de cada parte que se manda a estructurar. Con el prompt y la respuesta
 * queda por debajo de los tokens por minuto de Groq; más largo, el backend lo rechaza
 * como "demasiado_largo".
 */
const MAX_PART_CHARS = 10_000;

const TEXT_FIELDS = [
  'motivo_consulta', 'antecedentes_sintomas', 'examen_fisico', 'exploracion_estatica',
  'exploracion_dinamica', 'diagnostico', 'plan_terapeutico', 'estudios_complementarios',
  'laboratorio', 'medicacion', 'observaciones', 'descripcion_pedografia',
] as const;

/** Corta el texto en partes de hasta MAX_PART_CHARS, preferentemente al final de una oración. */
function splitText(text: string): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > MAX_PART_CHARS) {
    const window = rest.slice(0, MAX_PART_CHARS);
    const cut = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '));
    const end = cut > MAX_PART_CHARS / 2 ? cut + 1 : window.lastIndexOf(' ') > 0 ? window.lastIndexOf(' ') : MAX_PART_CHARS;
    parts.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** Une los resultados de cada parte: textos concatenados sin repetir, el primer dato no vacío para el resto. */
function mergeParts(results: any[]): any {
  const merged: any = { nombre_paciente: '', signos_vitales: {}, plantillas: false };
  for (const field of TEXT_FIELDS) {
    const values = results.map(r => (r?.[field] || '').trim()).filter(Boolean);
    merged[field] = [...new Set(values)].join('\n\n');
  }
  for (const r of results) {
    if (!merged.nombre_paciente && r?.nombre_paciente) merged.nombre_paciente = r.nombre_paciente;
    if (r?.plantillas) merged.plantillas = true;
    for (const [k, v] of Object.entries(r?.signos_vitales || {})) {
      if (v && !merged.signos_vitales[k]) merged.signos_vitales[k] = v;
    }
  }
  return merged;
}

/**
 * Estructura una transcripción en historia clínica. Si es larga, la procesa por partes
 * (cada una con sus propios reintentos si Groq está sin margen) y une los resultados.
 */
export async function structureTranscription(
  api: ApiService, text: string, onProgress?: (part: number, total: number) => void
): Promise<any> {
  const parts = splitText(text);
  const results: any[] = [];
  for (let i = 0; i < parts.length; i++) {
    onProgress?.(i + 1, parts.length);
    const { clinical_history } = await firstValueFrom(api.structureText(parts[i]));
    results.push(clinical_history);
  }
  return results.length === 1 ? results[0] : mergeParts(results);
}
