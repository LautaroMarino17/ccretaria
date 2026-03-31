export interface Patient {
  id?: string;
  nombre: string;
  apellido: string;
  dni: string;
  fecha_nacimiento: string;
  sexo: 'M' | 'F' | 'X';
  telefono?: string;
  email?: string;
  obra_social?: string;
  nro_afiliado?: string;
  diagnostico_inicial?: string;
  created_at?: any;
}
