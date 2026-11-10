export async function getDashboardSummary() {
  return {
    totalUsers: 128,
    activeSessions: 42,
    securityAlerts: 3,
    reportsGenerated: 17,
  };
}

export async function loginUser(email: string, password: string) {
  const isValid = email === 'admin@private.local' && password === 'private123';

  if (!isValid) {
    throw new Error('Invalid email or password.');
  }

  return {
    success: true,
    user: {
      name: 'Admin User',
      email,
      role: 'Owner',
    },
  };
}
