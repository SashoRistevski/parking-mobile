import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { login } from '../../src/api/auth';
import { displayErrorMessage } from '../../src/api/errors';
import { useAuth } from '../../src/auth/AuthContext';
import { AppText } from '../../src/components/AppText';
import { AuthScreen } from '../../src/components/AuthScreen';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { TextLink } from '../../src/components/TextLink';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function LoginScreen() {
  const { signInWithToken } = useAuth();
  const { t } = useLocale();
  const { colors } = useTheme();
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
    <AuthScreen title={t('logIn')}>
      <TextField
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder={t('email')}
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        autoCapitalize="none"
        autoComplete="password"
        placeholder={t('password')}
        secureTextEntry
        textContentType="password"
        value={password}
        onChangeText={setPassword}
      />
      {error ? (
        <AppText variant="body" style={{ color: colors.pay }}>
          {error}
        </AppText>
      ) : null}
      <Button
        title={submitting ? t('loggingIn') : t('logIn')}
        onPress={onSubmit}
        disabled={submitting}
      />
      <View style={styles.links}>
        <TextLink href="/(auth)/register">{t('createAccount')}</TextLink>
        <TextLink href="/(auth)/forgot-password">{t('forgotPassword')}</TextLink>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  links: {
    marginTop: 16,
    gap: 8,
  },
});
