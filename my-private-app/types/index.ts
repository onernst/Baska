export type UserRole = 'Owner' | 'Admin' | 'Member';

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};
