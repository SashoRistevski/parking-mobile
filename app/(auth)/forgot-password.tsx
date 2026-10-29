import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { forgotPassword } from '../../src/api/auth';
import { displayErrorMessage } from '../../src/api/errors';
import { AppText } from '../../src/components/AppText';
import { AuthScreen } from '../../src/components/AuthScreen';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { TextLink } from '../../src/components/TextLink';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { useTheme } from '../../src/theme/ThemeProvider';

function firstParam(value: string | string[] | undefined): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return '';
}

export default function ForgotPasswordScreen() {
  const { t } = useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const [email, setEmail] = useState(() => firstParam(params.email));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const trimmed = email.trim();
      await forgotPassword(trimmed);
      router.push({
        pathname: '/(auth)/reset-password',
        params: { email: trimmed },
      });
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
      <Button
        title={submitting ? t('sending') : t('sendReset')}
        onPress={onSubmit}
        disabled={submitting}
      />
      <View style={styles.links}>
        <TextLink href="/(auth)/login">{t('backToLogin')}</TextLink>
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
