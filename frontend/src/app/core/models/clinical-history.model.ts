export interface SignosVitales {
  tension_arterial: string;
  frecuencia_cardiaca: string;
  temperatura: string;
  peso: string;
  talla: string;
  saturacion: string;
}

export interface ManiobrasEntry { medicion: string; comentario: string; }

export interface ClinicalHistory {
  id?: string;
  patient_id: string;
  nombre_paciente?: string;
  motivo_consulta: string;
  antecedentes_sintomas: string;
  examen_fisico: string;
  exploracion_estatica?: string;
  exploracion_dinamica?: string;
  maniobras?: Record<string, ManiobrasEntry>;
  signos_vitales: SignosVitales;
  diagnostico: string;
  plan_terapeutico: string;
  estudios_complementarios: string;
  laboratorio: string;
  medicacion: string;
  observaciones: string;
  plantillas: boolean;
  descripcion_pedografia?: string;
  transcripcion_original?: string;
  verificada: boolean;
  fecha?: any;
}

export const EMPTY_SIGNOS_VITALES: SignosVitales = {
  tension_arterial: '',
  frecuencia_cardiaca: '',
  temperatura: '',
  peso: '',
  talla: '',
  saturacion: ''
};

export const MANIOBRA_SECTIONS: { label: string; joints: string[] }[] = [
  { label: 'Columna', joints: ['Cervical', 'Dorsal', 'Lumbar'] },
  { label: 'Hombro',  joints: ['Hombro'] },
  { label: 'Codo',    joints: ['Codo'] },
  { label: 'Muñeca',  joints: ['Muñeca'] },
  { label: 'Cadera',  joints: ['Cadera'] },
  { label: 'Rodilla', joints: ['Rodilla'] },
  { label: 'Tobillo', joints: ['Tobillo'] },
  { label: 'Mano',    joints: ['Mano'] },
  { label: 'Pie',     joints: ['Pie'] },
];

export const ALL_JOINTS = MANIOBRA_SECTIONS.flatMap(s => s.joints);

export function emptyManiobras(): Record<string, ManiobrasEntry> {
  return Object.fromEntries(ALL_JOINTS.map(j => [j, { medicion: '', comentario: '' }]));
}

export const EMPTY_CLINICAL_HISTORY: Omit<ClinicalHistory, 'patient_id'> = {
  nombre_paciente: '',
  motivo_consulta: '',
  antecedentes_sintomas: '',
  examen_fisico: '',
  exploracion_estatica: '',
  exploracion_dinamica: '',
  maniobras: emptyManiobras(),
  signos_vitales: { ...EMPTY_SIGNOS_VITALES },
  diagnostico: '',
  plan_terapeutico: '',
  estudios_complementarios: '',
  laboratorio: '',
  medicacion: '',
  observaciones: '',
  plantillas: false,
  descripcion_pedografia: '',
  transcripcion_original: '',
  verificada: false
};
