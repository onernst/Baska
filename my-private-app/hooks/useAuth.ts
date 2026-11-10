export function useAuth() {
  return {
    isAuthenticated: true,
    user: { name: 'Admin User', role: 'Owner' },
  };
}
