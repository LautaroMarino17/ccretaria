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
  antecedentes_sintomas: string;
  examen_fisico: string;
  signos_vitales: SignosVitales;
  diagnostico: string;
  plan_terapeutico: string;
  estudios_complementarios: string;
  laboratorio: string;
  medicacion: string;
  observaciones: string;
  plantillas: boolean;
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
  antecedentes_sintomas: '',
  examen_fisico: '',
  signos_vitales: { ...EMPTY_SIGNOS_VITALES },
  diagnostico: '',
  plan_terapeutico: '',
  estudios_complementarios: '',
  laboratorio: '',
  medicacion: '',
  observaciones: '',
  plantillas: false,
  transcripcion_original: '',
  verificada: false
};
