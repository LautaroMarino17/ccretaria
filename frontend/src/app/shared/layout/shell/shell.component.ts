import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell" [class.sidebar-open]="sidebarOpen()">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="brand-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <span>SecretarIA</span>
        </div>

        <nav class="sidebar-nav">
          @for (item of navItems(); track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              class="nav-item"
              (click)="closeSidebar()">
              <span class="nav-icon" [innerHTML]="item.icon"></span>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="sidebar-user">
          <div class="user-avatar">{{ userInitial() }}</div>
          <div class="user-info">
            <span class="user-name">{{ user?.displayName || user?.email }}</span>
            <span class="user-role">{{ roleLabel() }}</span>
          </div>
          <button class="btn-logout" (click)="logout()" title="Cerrar sesión">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      <!-- Overlay mobile -->
      <div class="overlay" (click)="closeSidebar()"></div>

      <!-- Main -->
      <main class="main">
        <header class="topbar">
          <button class="menu-toggle" (click)="toggleSidebar()">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div class="topbar-right">
            <span class="greeting">Hola, {{ firstName() }}</span>
          </div>
        </header>

        <div class="content">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: [`
    .shell {
      display: flex;
      min-height: 100vh;
      background: #f9fafb;
    }

    /* ── Sidebar ── */
    .sidebar {
      width: 240px;
      background: #111111;
      color: white;
      display: flex;
      flex-direction: column;
      position: fixed;
      height: 100vh;
      z-index: 100;
      transition: transform 0.3s;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px 20px;
      font-weight: 700;
      font-size: 18px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }

    .brand-icon {
      width: 36px; height: 36px;
      background: #16a34a;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
    }

    .sidebar-nav {
      flex: 1;
      padding: 16px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 10px;
      color: rgba(255,255,255,0.65);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.15s;
    }

    .nav-item:hover { background: rgba(255,255,255,0.08); color: white; }
    .nav-item.active { background: #16a34a; color: white; }

    .nav-icon { display: flex; align-items: center; }

    .sidebar-user {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 20px;
      border-top: 1px solid rgba(255,255,255,0.08);
    }

    .user-avatar {
      width: 34px; height: 34px;
      background: #16a34a;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 14px;
      flex-shrink: 0;
    }

    .user-info {
      flex: 1;
      overflow: hidden;
    }

    .user-name {
      display: block;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-role {
      display: block;
      font-size: 11px;
      color: rgba(255,255,255,0.5);
    }

    .btn-logout {
      background: none;
      border: none;
      color: rgba(255,255,255,0.5);
      cursor: pointer;
      padding: 4px;
      display: flex;
      transition: color 0.15s;
    }

    .btn-logout:hover { color: white; }

    /* ── Main ── */
    .main {
      flex: 1;
      margin-left: 240px;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .topbar {
      height: 60px;
      background: white;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .menu-toggle {
      display: none;
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: #374151;
    }

    .greeting { font-size: 14px; color: #6b7280; }

    .content {
      padding: 24px;
      max-width: 1200px;
      width: 100%;
    }

    .overlay { display: none; }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .sidebar {
        transform: translateX(-100%);
      }
      .shell.sidebar-open .sidebar {
        transform: translateX(0);
      }
      .shell.sidebar-open .overlay {
        display: block;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.4);
        z-index: 99;
      }
      .main { margin-left: 0; }
      .menu-toggle { display: flex; }
    }
  `]
})
export class ShellComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  sidebarOpen = signal(false);
  user = this.authService.currentUser;

  navItems = signal(this.buildNavItems());

  userInitial() {
    const user = this.authService.currentUser;
    return (user?.displayName || user?.email || '?')[0].toUpperCase();
  }

  firstName() {
    const user = this.authService.currentUser;
    return user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || '';
  }

  roleLabel() {
    return this.authService.currentUser?.role === 'professional' ? 'Profesional' : 'Paciente';
  }

  private buildNavItems() {
    return this.authService.currentUser?.role === 'patient'
      ? this.patientNav()
      : this.professionalNav();
  }

  private professionalNav() {
    return [
      { path: '/professional/dashboard', label: 'Inicio', icon: this.icon('home') },
      { path: '/professional/patients', label: 'Pacientes', icon: this.icon('users') },
      { path: '/professional/histories', label: 'Historias clínicas', icon: this.icon('file') },
      { path: '/professional/appointments', label: 'Turnos', icon: this.icon('calendar') },
      { path: '/profile', label: 'Mi perfil', icon: this.icon('user') },
    ];
  }

  private patientNav() {
    return [
      { path: '/patient/dashboard', label: 'Inicio', icon: this.icon('home') },
      { path: '/patient/histories', label: 'Mis historias', icon: this.icon('file') },
      { path: '/patient/routine', label: 'Mi rutina', icon: this.icon('activity') },
      { path: '/patient/evaluations', label: 'Evaluaciones', icon: this.icon('check') },
      { path: '/profile', label: 'Mi perfil', icon: this.icon('user') },
    ];
  }

  private icon(name: string): string {
    const icons: Record<string, string> = {
      home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      calendar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      file: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      activity: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
      check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
      user: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    };
    return icons[name] || '';
  }

  toggleSidebar() { this.sidebarOpen.update(v => !v); }
  closeSidebar() { this.sidebarOpen.set(false); }

  logout() {
    this.authService.logout().subscribe(() => this.router.navigate(['/login']));
  }
}
