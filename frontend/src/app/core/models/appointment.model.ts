export type AppointmentStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'completed';

export interface Appointment {
  id?: string;
  patient_id: string;
  patient_name: string;
  patient_uid?: string;
  professional_name: string;
  professional_uid?: string;
  datetime_iso?: string;
  appointment_datetime?: any;
  duration_minutes: number;
  notes?: string;
  status: AppointmentStatus;
}
