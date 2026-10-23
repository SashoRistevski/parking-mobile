import { useState } from 'react';

import { forgotPassword } from '../../src/api/auth';
import { displayErrorMessage } from '../../src/api/errors';
import { AppText } from '../../src/components/AppText';
import { AuthScreen } from '../../src/components/AuthScreen';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function ForgotPasswordScreen() {
  const { t } = useLocale();
  const { colors } = useTheme();
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
    <AuthScreen title={t('forgotPassword')}>
      <AppText variant="muted">{t('forgotPasswordHelp')}</AppText>
      <TextField
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder={t('email')}
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
      />
      {error ? (
        <AppText variant="body" style={{ color: colors.pay }}>
          {error}
        </AppText>
      ) : null}
      {message ? (
        <AppText variant="body" style={{ color: colors.primary }}>
          {message}
        </AppText>
      ) : null}
      <Button
        title={submitting ? t('sending') : t('sendReset')}
        onPress={onSubmit}
        disabled={submitting}
      />
    </AuthScreen>
  );
}
