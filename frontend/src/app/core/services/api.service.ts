import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { from, Observable, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private base = environment.apiUrl;

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

  getLinkCode() {
    return this.withAuth(h => this.http.get<any>(`${this.base}/auth/link-code`, { headers: h }));
  }

  resolveCode(code: string) {
    return this.withAuth(h =>
      this.http.get<any>(`${this.base}/auth/resolve-code/${code}`, { headers: h })
    );
  }

  linkToProfessional(linkCode: string, dni: string) {
    return this.withAuth(h =>
      this.http.post<any>(`${this.base}/auth/link-professional`, { link_code: linkCode, dni }, { headers: h })
    );
  }

  getMyLink() {
    return this.withAuth(h => this.http.get<any[]>(`${this.base}/auth/my-link`, { headers: h }));
  }

  requestLink(data: { link_code: string; dni: string; nombre: string; apellido: string; mensaje?: string }) {
    return this.withAuth(h =>
      this.http.post<any>(`${this.base}/auth/request-link`, data, { headers: h })
    );
  }

  getLinkRequests() {
    return this.withAuth(h => this.http.get<any[]>(`${this.base}/auth/link-requests`, { headers: h }));
  }

  actionLinkRequest(requestId: string, action: 'accept' | 'reject') {
    return this.withAuth(h =>
      this.http.post<any>(`${this.base}/auth/link-requests/action`, { request_id: requestId, action }, { headers: h })
    );
  }

  getMyLinkStatus() {
    return this.withAuth(h => this.http.get<any[]>(`${this.base}/auth/my-link-status`, { headers: h }));
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

  assignAppointment(data: { patient_id: string; patient_name: string; datetime_iso: string; duration_minutes: number; notes?: string; lugar?: string }) {
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

  shareRoutineByEmail(routineId: string, patientId: string) {
    return this.withAuth(h =>
      this.http.post<any>(`${this.base}/routines/${routineId}/patient/${patientId}/share-email`, {}, { headers: h })
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

  // ── Grabación / Transcripción ────────────────────────────────────
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
}
