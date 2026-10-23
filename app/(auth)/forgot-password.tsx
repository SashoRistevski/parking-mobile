import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput } from 'react-native';

import { forgotPassword } from '../../src/api/auth';
import { displayErrorMessage } from '../../src/api/errors';
import { AuthScreen } from '../../src/components/AuthScreen';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const result = await forgotPassword(email.trim());
      setMessage(result.message);
    } catch (err) {
      setError(displayErrorMessage(err, 'email') || displayErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen title="Forgot password">
      <Text style={styles.help}>Enter the email address for your account.</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Button
        title={submitting ? 'Sending…' : 'Send reset link'}
        onPress={onSubmit}
        disabled={submitting}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  help: {
    marginBottom: 8,
    color: '#444',
  },
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
  message: {
    color: '#1b5e20',
  },
});
