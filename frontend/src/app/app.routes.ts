import { Routes } from '@angular/router';
import { authGuard, professionalGuard, patientGuard } from './core/guards/auth.guard';


export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // ── Auth ─────────────────────────────────────────────────────────
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },

  // ── Profesional ──────────────────────────────────────────────────
  {
    path: 'professional',
    canActivate: [professionalGuard],
    loadComponent: () => import('./shared/layout/shell/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/professional/dashboard/professional-dashboard.component')
          .then(m => m.ProfessionalDashboardComponent)
      },
      {
        path: 'patients',
        loadComponent: () => import('./features/professional/patients/patients-list.component')
          .then(m => m.PatientsListComponent)
      },
      {
        path: 'patients/new',
        loadComponent: () => import('./features/professional/patients/new-patient.component')
          .then(m => m.NewPatientComponent)
      },
      {
        path: 'patients/:id',
        loadComponent: () => import('./features/professional/patients/patient-detail.component')
          .then(m => m.PatientDetailComponent)
      },
      {
        path: 'record/:patientId',
        loadComponent: () => import('./features/professional/record-history/record-history.component')
          .then(m => m.RecordHistoryComponent)
      },
      {
        path: 'appointments',
        loadComponent: () => import('./features/professional/appointments/professional-appointments.component')
          .then(m => m.ProfessionalAppointmentsComponent)
      },
      {
        path: 'histories',
        loadComponent: () => import('./features/professional/histories/professional-histories.component')
          .then(m => m.ProfessionalHistoriesComponent)
      },
      {
        path: 'patients/:patientId/routines',
        loadComponent: () => import('./features/professional/routines/manage-routines.component')
          .then(m => m.ManageRoutinesComponent)
      },
      {
        path: 'patients/:patientId/evaluations',
        loadComponent: () => import('./features/professional/evaluations/professional-evaluations.component')
          .then(m => m.ProfessionalEvaluationsComponent)
      }
    ]
  },

  // ── Paciente ─────────────────────────────────────────────────────
  {
    path: 'patient',
    canActivate: [patientGuard],
    loadComponent: () => import('./shared/layout/shell/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/patient/patient-dashboard/patient-dashboard.component')
          .then(m => m.PatientDashboardComponent)
      },
      {
        path: 'link',
        loadComponent: () => import('./features/patient/link/patient-link.component')
          .then(m => m.PatientLinkComponent)
      },
      {
        path: 'histories',
        loadComponent: () => import('./features/patient/clinical-histories/patient-histories.component')
          .then(m => m.PatientHistoriesComponent)
      },
      {
        path: 'routine',
        loadComponent: () => import('./features/patient/routine/patient-routine.component')
          .then(m => m.PatientRoutineComponent)
      },
      {
        path: 'appointments',
        loadComponent: () => import('./features/patient/appointments/patient-appointments.component')
          .then(m => m.PatientAppointmentsComponent)
      },
      {
        path: 'evaluations',
        loadComponent: () => import('./features/patient/evaluations/patient-evaluations.component')
          .then(m => m.PatientEvaluationsComponent)
      }
    ]
  },

  // ── Perfil (ambos roles) ─────────────────────────────────────────
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/layout/shell/shell.component').then(m => m.ShellComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
      }
    ]
  },

  { path: '**', redirectTo: 'login' }
];
