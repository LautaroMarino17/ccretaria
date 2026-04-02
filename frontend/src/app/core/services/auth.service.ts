import { Injectable, inject } from '@angular/core';
import {
  Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, User, updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail
} from '@angular/fire/auth';
import { BehaviorSubject, from } from 'rxjs';
import { AppUser, UserRole } from '../models/user.model';

// undefined = todavía cargando, null = no autenticado, AppUser = autenticado
type AuthState = AppUser | null | undefined;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  private currentUserSubject = new BehaviorSubject<AuthState>(undefined);

  currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        const role = await this.getUserRole(user);
        this.currentUserSubject.next({
          uid: user.uid,
          email: user.email!,
          displayName: user.displayName,
          role
        });
      } else {
        this.currentUserSubject.next(null);
      }
    });
  }

  private async getUserRole(user: User): Promise<UserRole | null> {
    const idTokenResult = await user.getIdTokenResult(true);
    return (idTokenResult.claims['role'] as UserRole) || null;
  }

  async getIdToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        unsubscribe();
        if (user) {
          user.getIdToken().then(resolve).catch(reject);
        } else {
          reject(new Error('No hay usuario autenticado'));
        }
      });
    });
  }

  get currentUser(): AppUser | null {
    const v = this.currentUserSubject.value;
    return v === undefined ? null : v;
  }

  login(email: string, password: string) {
    return from(signInWithEmailAndPassword(this.auth, email, password));
  }

  register(email: string, password: string, displayName: string) {
    return from(
      createUserWithEmailAndPassword(this.auth, email, password).then(async (cred) => {
        await updateProfile(cred.user, { displayName });
        return cred;
      })
    );
  }

  async refreshUser(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;
    const role = await this.getUserRole(user);
    this.currentUserSubject.next({
      uid: user.uid,
      email: user.email!,
      displayName: user.displayName,
      role
    });
  }

  changePassword(currentPassword: string, newPassword: string) {
    const user = this.auth.currentUser!;
    const credential = EmailAuthProvider.credential(user.email!, currentPassword);
    return from(
      reauthenticateWithCredential(user, credential)
        .then(() => updatePassword(user, newPassword))
    );
  }

  resetPassword(email: string) {
    return from(sendPasswordResetEmail(this.auth, email));
  }

  logout() {
    return from(signOut(this.auth));
  }
}
