import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { resetPassword } from '../../src/api/auth';
import { displayErrorMessage } from '../../src/api/errors';
import { AppText } from '../../src/components/AppText';
import { AuthScreen } from '../../src/components/AuthScreen';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { TextLink } from '../../src/components/TextLink';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { useTheme } from '../../src/theme/ThemeProvider';

const REDIRECT_MS = 1800;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

function firstParam(value: string | string[] | undefined): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return '';
}

export default function ResetPasswordScreen() {
  const { t } = useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const emailFromParams = firstParam(params.email);
  const [email, setEmail] = useState(emailFromParams);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const showSentBanner = emailFromParams.length > 0 && !success;
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current !== null) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  async function onSubmit() {
    if (code.length !== 6 || submitting) {
      return;
    }
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      await resetPassword(email.trim(), code, password);
      setSuccess(true);
      redirectTimeoutRef.current = setTimeout(() => {
        router.replace('/(auth)/login');
      }, REDIRECT_MS);
    } catch (err) {
      setError(
        displayErrorMessage(err, 'code') ||
          displayErrorMessage(err, 'email') ||
          displayErrorMessage(err, 'password') ||
          displayErrorMessage(err),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen title={t('resetPassword')}>
      {showSentBanner ? (
        <AppText variant="body" style={{ color: colors.primary }}>
          {t('forgotPasswordSent')}
        </AppText>
      ) : null}
      <TextField
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder={t('email')}
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        autoComplete="one-time-code"
        keyboardType="number-pad"
        maxLength={6}
        placeholder={t('resetCode')}
        textContentType="oneTimeCode"
        value={code}
        onChangeText={(value) => setCode(digitsOnly(value))}
      />
      <TextField
        autoCapitalize="none"
        autoComplete="password-new"
        placeholder={t('passwordHint')}
        secureTextEntry
        textContentType="newPassword"
        value={password}
        onChangeText={setPassword}
        accessibilityLabel={t('newPassword')}
      />
      {error ? (
        <AppText variant="body" style={{ color: colors.pay }}>
          {error}
        </AppText>
      ) : null}
      {success ? (
        <AppText variant="body" style={{ color: colors.primary }}>
          {t('resetPasswordSuccess')}
        </AppText>
      ) : null}
      {!success ? (
        <>
          <Button
            title={
              submitting
                ? t('resetPasswordSubmitting')
                : t('resetPasswordSubmit')
            }
            onPress={onSubmit}
            disabled={code.length !== 6 || submitting}
          />
          <View style={styles.links}>
            <TextLink
              href={
                email.trim()
                  ? {
                      pathname: '/(auth)/forgot-password',
                      params: { email: email.trim() },
                    }
                  : '/(auth)/forgot-password'
              }
            >
              {t('back')}
            </TextLink>
          </View>
        </>
      ) : (
        <View style={styles.links}>
          <TextLink href="/(auth)/login" replace>
            {t('loginNow')}
          </TextLink>
        </View>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  links: {
    marginTop: 16,
    gap: 8,
  },
});
