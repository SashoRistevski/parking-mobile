import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  resendEmailVerificationCode,
  verifyEmail,
} from '../../src/api/auth';
import { displayErrorMessage } from '../../src/api/errors';
import { useAuth } from '../../src/auth/AuthContext';
import { AppText } from '../../src/components/AppText';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { useTheme } from '../../src/theme/ThemeProvider';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

export default function VerifyEmailScreen() {
  const { t } = useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const {
    clearPostRegisterSetup,
    pendingPostRegisterSetup,
    refreshUser,
  } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resentMessage, setResentMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [resending, setResending] = useState(false);

  const goAfterEmailStep = useCallback(() => {
    if (pendingPostRegisterSetup) {
      clearPostRegisterSetup();
      router.replace('/(app)/setup');
      return;
    }
    router.replace('/(app)/(tabs)');
  }, [clearPostRegisterSetup, pendingPostRegisterSetup, router]);

  async function onConfirm() {
    if (code.length !== 6 || confirming) {
      return;
    }
    setError(null);
    setResentMessage(null);
    setConfirming(true);
    try {
      await verifyEmail(code);
      try {
        await refreshUser();
      } catch {
        // tabs still work; banner may linger until next /me
      }
      goAfterEmailStep();
    } catch (err) {
      setError(displayErrorMessage(err));
    } finally {
      setConfirming(false);
    }
  }

  async function onResend() {
    if (resending) {
      return;
    }
    setError(null);
    setResentMessage(null);
    setResending(true);
    try {
      await resendEmailVerificationCode();
      setResentMessage(t('emailVerifyResent'));
    } catch (err) {
      setError(displayErrorMessage(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <Screen scroll includeTopInset={false}>
      <AppText variant="body" style={{ color: colors.muted }}>
        {t('emailVerifyBody')}
      </AppText>
      <View style={styles.field}>
        <AppText variant="label">{t('emailVerifyCode')}</AppText>
        <TextField
          autoComplete="one-time-code"
          keyboardType="number-pad"
          maxLength={6}
          textContentType="oneTimeCode"
          value={code}
          onChangeText={(value) => setCode(digitsOnly(value))}
        />
      </View>
      {error ? (
        <AppText variant="body" style={{ color: colors.pay }}>
          {error}
        </AppText>
      ) : null}
      {resentMessage ? (
        <AppText variant="body" style={{ color: colors.primary }}>
          {resentMessage}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button
          title={confirming ? t('emailVerifyConfirming') : t('emailVerifyConfirm')}
          onPress={onConfirm}
          disabled={code.length !== 6 || confirming}
        />
        <Button
          title={resending ? t('emailVerifyResending') : t('emailVerifyResend')}
          onPress={onResend}
          disabled={resending}
          variant="text"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    marginTop: 20,
    gap: 6,
  },
  actions: {
    marginTop: 24,
    gap: 8,
  },
});
