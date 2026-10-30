import { type ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import type { Locale } from '../i18n/catalogs';
import { useLocale } from '../i18n/LocaleProvider';
import { useInterLoaded } from '../theme/FontContext';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type AuthScreenProps = {
  title: string;
  children: ReactNode;
  showBrandLogo?: boolean;
  showAppName?: boolean;
  appName?: string;
  topSlot?: ReactNode;
  alignTop?: boolean;
  showLocalePicker?: boolean;
};

function LocalePicker() {
  const { locale, setLocale, t } = useLocale();
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
      {(['mk', 'en'] as const).map((code: Locale) => {
        const active = locale === code;
        const label = code === 'mk' ? t('localeMk') : t('localeEn');
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

export function AuthScreen({
  title,
  children,
  showBrandLogo = false,
  showAppName = false,
  appName,
  topSlot,
  alignTop = false,
  showLocalePicker = false,
}: AuthScreenProps) {
  const { colors } = useTheme();
  const interLoaded = useInterLoaded();
  const { t } = useLocale();
  const logoAccessibilityLabel = `${t('appName')}. ${t('tagline')}`;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          alignTop ? styles.contentTop : null,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {showLocalePicker || topSlot ? (
          <View style={styles.topSlot}>
            {showLocalePicker ? <LocalePicker /> : null}
            {topSlot}
          </View>
        ) : null}
        {showBrandLogo ? (
          <View
            style={[
              styles.logoTile,
              { borderColor: colors.border },
            ]}
          >
            <Image
              accessibilityLabel={logoAccessibilityLabel}
              accessible
              resizeMode="contain"
              source={require('../../assets/smartpark-logo.png')}
              style={styles.logo}
            />
            <AppText
              variant="body"
              style={[styles.tagline, { color: colors.muted }]}
            >
              {t('tagline')}
            </AppText>
          </View>
        ) : null}
        {showAppName && appName ? (
          <AppText variant="title" style={styles.appName}>
            {appName}
          </AppText>
        ) : null}
        <AppText
          variant="title"
          style={[
            showBrandLogo ? styles.titleBelowLogo : undefined,
            alignTop && interLoaded ? { fontFamily: 'Inter_700Bold' } : undefined,
          ]}
        >
          {title}
        </AppText>
        <View style={[styles.form, alignTop ? styles.formTop : null]}>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  contentTop: {
    justifyContent: 'flex-start',
    paddingTop: 64,
  },
  topSlot: {
    alignItems: 'flex-end',
    marginBottom: 22,
    gap: 12,
  },
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
  logoTile: {
    alignSelf: 'center',
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
  },
  logo: {
    width: 168,
    height: 139,
  },
  tagline: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  appName: {
    textAlign: 'center',
    marginBottom: 8,
  },
  titleBelowLogo: {
    fontSize: 24,
    lineHeight: 29,
  },
  form: {
    gap: 12,
    marginTop: 24,
  },
  formTop: {
    gap: 14,
    marginTop: 14,
  },
});
