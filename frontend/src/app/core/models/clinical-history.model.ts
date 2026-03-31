export interface SignosVitales {
  tension_arterial: string;
  frecuencia_cardiaca: string;
  temperatura: string;
  peso: string;
  talla: string;
  saturacion: string;
}

export interface ClinicalHistory {
  id?: string;
  patient_id: string;
  nombre_paciente?: string;
  motivo_consulta: string;
  enfermedad_actual: string;
  antecedentes_personales: string;
  antecedentes_familiares: string;
  examen_fisico: string;
  signos_vitales: SignosVitales;
  diagnostico: string;
  plan_terapeutico: string;
  estudios_complementarios: string;
  observaciones: string;
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

export const EMPTY_CLINICAL_HISTORY: Omit<ClinicalHistory, 'patient_id'> = {
  nombre_paciente: '',
  motivo_consulta: '',
  enfermedad_actual: '',
  antecedentes_personales: '',
  antecedentes_familiares: '',
  examen_fisico: '',
  signos_vitales: { ...EMPTY_SIGNOS_VITALES },
  diagnostico: '',
  plan_terapeutico: '',
  estudios_complementarios: '',
  observaciones: '',
  transcripcion_original: '',
  verificada: false
};
