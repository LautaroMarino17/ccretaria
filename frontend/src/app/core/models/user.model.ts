export type UserRole = 'patient' | 'professional';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string | null;
  role: UserRole | null;
}
