import { Redirect } from 'expo-router';

import { useAuth } from '../src/auth/AuthContext';

export default function Index() {
  const { token, user } = useAuth();

  if (token && user) {
    return <Redirect href="/(app)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
