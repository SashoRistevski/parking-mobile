import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type TextStyle,
} from 'react-native';

import { register } from '../../src/api/auth';
import { displayErrorMessage } from '../../src/api/errors';
import { useAuth } from '../../src/auth/AuthContext';
import { AppText } from '../../src/components/AppText';
import { AuthScreen } from '../../src/components/AuthScreen';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { TextLink } from '../../src/components/TextLink';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { useInterLoaded } from '../../src/theme/FontContext';
import { useTheme } from '../../src/theme/ThemeProvider';

function RegisterLanguageSwitch() {
  const { locale, setLocale } = useLocale();
  const { colors, isDark } = useTheme();
  const interLoaded = useInterLoaded();
  const activeTextColor = isDark ? colors.textOnPrimary : '#FFFFFF';

  return (
    <View
      accessibilityRole="radiogroup"
      style={[
        styles.langPill,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {(['mk', 'en'] as const).map((code) => {
        const active = locale === code;
        const label = code === 'mk' ? 'МК' : 'EN';
        return (
          <Pressable
            key={code}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => setLocale(code)}
            style={[
              styles.langSegment,
              active ? { backgroundColor: colors.primary } : null,
            ]}
          >
            <AppText
              variant="body"
              style={[
                styles.langSegmentText,
                interLoaded ? { fontFamily: 'Inter_700Bold' } : null,
                active
                  ? { color: activeTextColor }
                  : { color: colors.muted },
              ]}
            >
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  const interLoaded = useInterLoaded();
  const labelStyle: TextStyle = interLoaded
    ? { fontFamily: 'Inter_600SemiBold' }
    : {};

  return (
    <AppText variant="label" style={labelStyle}>
      {children}
    </AppText>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </View>
  );
}

export default function RegisterScreen() {
  const { signInWithToken, markPostRegisterSetup } = useAuth();
  const { t } = useLocale();
  const { colors, isDark } = useTheme();
  const interLoaded = useInterLoaded();
  const onPrimaryIconColor = isDark ? colors.textOnPrimary : '#FFFFFF';
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = termsAccepted && !submitting;

  async function onSubmit() {
    if (!termsAccepted) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await register(
        username.trim(),
        email.trim(),
        password,
      );
      await signInWithToken(result.accessToken);
      markPostRegisterSetup();
    } catch (err) {
      setError(
        displayErrorMessage(err, 'email') ||
          displayErrorMessage(err, 'username') ||
          displayErrorMessage(err),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen
      alignTop
      showBrandLogo
      title={t('createProfile')}
      topSlot={<RegisterLanguageSwitch />}
    >
      <AppText
        variant="body"
        style={[
          styles.reminder,
          { color: colors.muted },
          interLoaded ? { fontFamily: 'Inter_400Regular' } : null,
        ]}
      >
        {t('registerReminder')}
      </AppText>
      <LabeledField label={t('nameLabel')}>
        <TextField
          autoCapitalize="words"
          autoComplete="username"
          textContentType="username"
          value={username}
          onChangeText={setUsername}
        />
      </LabeledField>
      <LabeledField label={t('email')}>
        <TextField
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder={t('emailPlaceholder')}
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
        />
      </LabeledField>
      <LabeledField label={t('password')}>
        <TextField
          autoCapitalize="none"
          autoComplete="password-new"
          placeholder={t('passwordHint')}
          secureTextEntry
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
        />
      </LabeledField>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: termsAccepted }}
        onPress={() => setTermsAccepted((value) => !value)}
        style={styles.termsRow}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: colors.border },
            termsAccepted
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : { backgroundColor: colors.card },
          ]}
        >
          {termsAccepted ? (
            <Ionicons
              color={onPrimaryIconColor}
              name="checkmark"
              size={16}
            />
          ) : null}
        </View>
        <AppText variant="muted" style={styles.termsText}>
          {t('agreeTerms')}
        </AppText>
      </Pressable>
      {error ? (
        <AppText variant="body" style={{ color: colors.pay }}>
          {error}
        </AppText>
      ) : null}
      <Button
        title={submitting ? t('creatingAccount') : t('createProfile')}
        onPress={onSubmit}
        disabled={!canSubmit}
      />
      <View style={styles.footerRow}>
        <AppText variant="body" style={{ color: colors.muted, fontSize: 15 }}>
          {t('alreadyHaveProfile')}{' '}
        </AppText>
        <TextLink href="/(auth)/login">{t('logInLink')}</TextLink>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  langPill: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    padding: 3,
  },
  langSegment: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langSegmentText: {
    fontSize: 13,
    lineHeight: 16,
  },
  reminder: {
    fontSize: 15,
    lineHeight: 22,
  },
  field: {
    gap: 6,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsText: {
    flex: 1,
    lineHeight: 20,
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
