import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { finalize, from, Observable, retry, switchMap, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private base = environment.apiUrl;

  /** true mientras algún pedido de IA espera porque Groq está saturado ("Procesando, puede demorar"). */
  aiPending = signal(false);

  /**
   * Si el backend responde 503 { codigo: 'pendiente', reintentar_en }, espera y reintenta
   * (con token nuevo). El audio nunca sale del navegador mientras tanto.
   */
  private retryWhilePending<T>(maxRetries = 20) {
    return (source: Observable<T>) => source.pipe(
      retry({
        count: maxRetries,
        delay: (err: any) => {
          if (err?.status !== 503 || err?.error?.detail?.codigo !== 'pendiente') {
            return throwError(() => err);
          }
          this.aiPending.set(true);
          const secs = Number(err.error.detail.reintentar_en) || 30;
          return timer(Math.min(secs, 120) * 1000);
        }
      }),
      finalize(() => this.aiPending.set(false))
    );
  }

  private withAuth<T>(request: (headers: HttpHeaders) => Observable<T>): Observable<T> {
    return from(this.auth.getIdToken()).pipe(
      switchMap(token => {
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        return request(headers);
      })
    );
  }

  // ── Auth / perfil ────────────────────────────────────────────────
  getMe() {
    return this.withAuth(h => this.http.get<any>(`${this.base}/auth/me`, { headers: h }));
  }

  getProfessionalProfile() {
    return this.withAuth(h => this.http.get<any>(`${this.base}/auth/professional-profile`, { headers: h }));
  }

  updateProfessionalProfile(data: { telefono?: string; lugares_atencion?: string[] }) {
    return this.withAuth(h => this.http.patch<any>(`${this.base}/auth/professional-profile`, data, { headers: h }));
  }

  updateMyPhone(telefono: string) {
    return this.withAuth(h => this.http.patch<any>(`${this.base}/auth/patient-phone`, { telefono }, { headers: h }));
  }

  acceptLegal() {
    return this.withAuth(h => this.http.post<{ message: string; version: string }>(`${this.base}/auth/accept-legal`, {}, { headers: h }));
  }

  assignAppointment(data: { patient_id: string; patient_name: string; datetime_iso: string; duration_minutes: number; notes?: string; lugar?: string; tipo?: string }) {
    return this.withAuth(h => this.http.post<any>(`${this.base}/appointments/assign`, data, { headers: h }));
  }

  // ── Pacientes ────────────────────────────────────────────────────
  getPatients() {
    return this.withAuth(h => this.http.get<any[]>(`${this.base}/patients/`, { headers: h }));
  }

  getPatient(id: string) {
    return this.withAuth(h => this.http.get<any>(`${this.base}/patients/${id}`, { headers: h }));
  }

  createPatient(data: any) {
    return this.withAuth(h => this.http.post<any>(`${this.base}/patients/`, data, { headers: h }));
  }

  updatePatientPhone(id: string, telefono: string) {
    return this.withAuth(h => this.http.patch<any>(`${this.base}/patients/${id}`, { telefono }, { headers: h }));
  }

  updatePatientEmail(id: string, email: string) {
    return this.withAuth(h => this.http.patch<any>(`${this.base}/patients/${id}`, { email }, { headers: h }));
  }

  updatePatient(id: string, data: { nombre?: string; apellido?: string; dni?: string; telefono?: string; email?: string; obra_social?: string; nro_afiliado?: string }) {
    return this.withAuth(h => this.http.patch<any>(`${this.base}/patients/${id}`, data, { headers: h }));
  }

  deletePatient(id: string) {
    return this.withAuth(h => this.http.delete<any>(`${this.base}/patients/${id}`, { headers: h }));
  }

  // ── Rutinas de ejercicios ────────────────────────────────────────
  getRoutines(patientId: string) {
    return this.withAuth(h =>
      this.http.get<any[]>(`${this.base}/routines/patient/${patientId}`, { headers: h })
    );
  }

  createRoutine(data: any) {
    return this.withAuth(h =>
      this.http.post<any>(`${this.base}/routines/`, data, { headers: h })
    );
  }

  updateRoutine(routineId: string, patientId: string, data: any) {
    return this.withAuth(h =>
      this.http.put<any>(`${this.base}/routines/${routineId}/patient/${patientId}`, data, { headers: h })
    );
  }

  deleteRoutine(routineId: string, patientId: string) {
    return this.withAuth(h =>
      this.http.delete<any>(`${this.base}/routines/${routineId}/patient/${patientId}`, { headers: h })
    );
  }

  // ── Historia Clínica ─────────────────────────────────────────────
  getAllClinicalHistories() {
    return this.withAuth(h => this.http.get<any[]>(`${this.base}/clinical-history/`, { headers: h }));
  }

  getClinicalHistories(patientId: string) {
    return this.withAuth(h =>
      this.http.get<any[]>(`${this.base}/clinical-history/patient/${patientId}`, { headers: h })
    );
  }

  saveClinicalHistory(data: any) {
    return this.withAuth(h =>
      this.http.post<any>(`${this.base}/clinical-history/`, data, { headers: h })
    );
  }

  updateClinicalHistory(historyId: string, patientId: string, data: any) {
    return this.withAuth(h =>
      this.http.patch<any>(`${this.base}/clinical-history/${historyId}/patient/${patientId}`, data, { headers: h })
    );
  }

  deleteClinicalHistory(historyId: string, patientId: string) {
    return this.withAuth(h =>
      this.http.delete<any>(`${this.base}/clinical-history/${historyId}/patient/${patientId}`, { headers: h })
    );
  }

  // ── Evaluaciones ────────────────────────────────────────────────
  getAllEvaluations() {
    return this.withAuth(h => this.http.get<any[]>(`${this.base}/evaluations/`, { headers: h }));
  }

  getEvaluations(patientId: string) {
    return this.withAuth(h =>
      this.http.get<any[]>(`${this.base}/evaluations/patient/${patientId}`, { headers: h })
    );
  }

  createEvaluation(data: any) {
    return this.withAuth(h =>
      this.http.post<any>(`${this.base}/evaluations/`, data, { headers: h })
    );
  }

  updateEvaluation(evalId: string, patientId: string, data: any) {
    return this.withAuth(h =>
      this.http.patch<any>(`${this.base}/evaluations/${evalId}/patient/${patientId}`, data, { headers: h })
    );
  }

  deleteEvaluation(evalId: string, patientId: string) {
    return this.withAuth(h =>
      this.http.delete<any>(`${this.base}/evaluations/${evalId}/patient/${patientId}`, { headers: h })
    );
  }

  // ── Admin ────────────────────────────────────────────────────────────────────
  getAdminProfessionals() {
    return this.withAuth(h => this.http.get<any[]>(`${this.base}/admin/professionals`, { headers: h }));
  }

  updateProfessionalPlan(uid: string, plan: number) {
    return this.withAuth(h => this.http.patch<any>(`${this.base}/admin/professionals/${uid}/plan`, { plan }, { headers: h }));
  }

  getAdminAiUsage() {
    return this.withAuth(h => this.http.get<any>(`${this.base}/admin/ai-usage`, { headers: h }));
  }

  // ── Cupo de IA ──────────────────────────────────────────────────────────────
  getAiUsage() {
    return this.withAuth(h => this.http.get<any>(`${this.base}/usage/me`, { headers: h }));
  }

  // ── Comandos de voz ─────────────────────────────────────────────────────────
  interpretVoiceCommand(text: string, context?: any) {
    return this.withAuth(h => this.http.post<any>(`${this.base}/voice-command/interpret`, { text, context }, { headers: h }))
      .pipe(this.retryWhilePending(1));
  }

  // ── Grabación / Transcripción ────────────────────────────────────
  /** origen: 'consulta' (grabación de historia clínica) o 'amalia' (comando de voz). */
  transcribeChunk(audioBlob: Blob, origen: 'consulta' | 'amalia' = 'consulta'): Observable<{ text: string }> {
    return from(this.auth.getIdToken()).pipe(
      switchMap(token => {
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'chunk.webm');
        formData.append('origen', origen);
        return this.http.post<{ text: string }>(`${this.base}/recording/transcribe-chunk`, formData, { headers });
      }),
      this.retryWhilePending(origen === 'amalia' ? 1 : 20)
    );
  }

  structureText(transcription: string): Observable<{ clinical_history: any }> {
    return this.withAuth(h =>
      this.http.post<any>(`${this.base}/recording/structure`, { transcription }, { headers: h })
    ).pipe(this.retryWhilePending());
  }

  transcribeRoutine(audioBlob: Blob): Observable<any> {
    return from(this.auth.getIdToken()).pipe(
      switchMap(token => {
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        return this.http.post<any>(`${this.base}/recording/transcribe-routine`, formData, { headers });
      }),
      this.retryWhilePending()
    );
  }

  transcribeAndStructure(audioBlob: Blob): Observable<any> {
    return from(this.auth.getIdToken()).pipe(
      switchMap(token => {
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        return this.http.post<any>(
          `${this.base}/recording/transcribe-and-structure`,
          formData,
          { headers }
        );
      })
    );
  }


  // ── Turnos ───────────────────────────────────────────────────────
  getAppointments() {
    return this.withAuth(h =>
      this.http.get<any[]>(`${this.base}/appointments/`, { headers: h })
    );
  }

  // Profesional: gestión de horarios disponibles
  getMySlots() {
    return this.withAuth(h =>
      this.http.get<any[]>(`${this.base}/appointments/slots`, { headers: h })
    );
  }

  createSlot(data: { datetime_iso: string; duration_minutes: number; notes?: string; lugar?: string }) {
    return this.withAuth(h =>
      this.http.post<any>(`${this.base}/appointments/slots`, data, { headers: h })
    );
  }

  deleteSlot(slotId: string) {
    return this.withAuth(h =>
      this.http.delete<any>(`${this.base}/appointments/slots/${slotId}`, { headers: h })
    );
  }

  // Paciente: ver disponibilidad y reservar
  getAvailableSlots(professionalUid: string) {
    return this.withAuth(h =>
      this.http.get<any[]>(`${this.base}/appointments/available/${professionalUid}`, { headers: h })
    );
  }

  bookAppointment(data: { professional_uid: string; slot_id: string; notes?: string }) {
    return this.withAuth(h =>
      this.http.post<any>(`${this.base}/appointments/book`, data, { headers: h })
    );
  }

  cancelAppointment(appointmentId: string) {
    return this.withAuth(h =>
      this.http.patch<any>(`${this.base}/appointments/${appointmentId}/cancel`, {}, { headers: h })
    );
  }

  cancelByProfessional(appointmentId: string) {
    return this.withAuth(h =>
      this.http.post<any>(`${this.base}/appointments/${appointmentId}/cancel-by-professional`, {}, { headers: h })
    );
  }

  confirmAppointment(appointmentId: string) {
    return this.withAuth(h =>
      this.http.post<any>(`${this.base}/appointments/${appointmentId}/confirm`, {}, { headers: h })
    );
  }

  rejectAppointment(appointmentId: string) {
    return this.withAuth(h =>
      this.http.post<any>(`${this.base}/appointments/${appointmentId}/reject`, {}, { headers: h })
    );
  }

  getDaySlots(professionalUid: string, date: string) {
    return this.withAuth(h =>
      this.http.get<any[]>(`${this.base}/appointments/slots-day/${professionalUid}?date=${date}`, { headers: h })
    );
  }

  getDayAppointments(date: string) {
    return this.withAuth(h =>
      this.http.get<any[]>(`${this.base}/appointments/day?date=${date}`, { headers: h })
    );
  }

  deleteAppointment(appointmentId: string) {
    return this.withAuth(h =>
      this.http.delete<any>(`${this.base}/appointments/${appointmentId}`, { headers: h })
    );
  }

  triggerNotifications() {
    return this.withAuth(h =>
      this.http.post<any>(`${this.base}/appointments/notify`, {}, { headers: h })
    );
  }

  saveFcmToken(token: string) {
    return this.withAuth(h =>
      this.http.post<any>(`${this.base}/auth/fcm-token`, { token }, { headers: h })
    );
  }

  triggerDailyPush() {
    return this.withAuth(h =>
      this.http.post<any>(`${this.base}/appointments/notify-push`, {}, { headers: h })
    );
  }
}
