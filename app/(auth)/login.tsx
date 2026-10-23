import { Link } from 'expo-router';
import { useState } from 'react';
import {
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { login } from '../../src/api/auth';
import { displayErrorMessage } from '../../src/api/errors';
import { useAuth } from '../../src/auth/AuthContext';
import { AuthScreen } from '../../src/components/AuthScreen';

export default function LoginScreen() {
  const { signInWithToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      await signInWithToken(result.accessToken);
    } catch (err) {
      setError(displayErrorMessage(err, 'email') || displayErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen title="Log in">
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        autoCapitalize="none"
        autoComplete="password"
        placeholder="Password"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={submitting ? 'Logging in…' : 'Log in'}
        onPress={onSubmit}
        disabled={submitting}
      />
      <View style={styles.links}>
        <Link href="/(auth)/register">Create an account</Link>
        <Link href="/(auth)/forgot-password">Forgot password</Link>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    color: '#b00020',
  },
  links: {
    marginTop: 16,
    gap: 8,
  },
});
