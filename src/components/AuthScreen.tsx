import { type ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { useInterLoaded } from '../theme/FontContext';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

const LOGO_ACCESSIBILITY_LABEL =
  'Smart Park. Автоматски. Прецизно. Безгрижно.';

type AuthScreenProps = {
  title: string;
  children: ReactNode;
  showBrandLogo?: boolean;
  showAppName?: boolean;
  appName?: string;
  topSlot?: ReactNode;
  alignTop?: boolean;
};

export function AuthScreen({
  title,
  children,
  showBrandLogo = false,
  showAppName = false,
  appName,
  topSlot,
  alignTop = false,
}: AuthScreenProps) {
  const { colors } = useTheme();
  const interLoaded = useInterLoaded();

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
        {topSlot ? <View style={styles.topSlot}>{topSlot}</View> : null}
        {showBrandLogo ? (
          <View
            style={[
              styles.logoTile,
              { borderColor: colors.border },
            ]}
          >
            <Image
              accessibilityLabel={LOGO_ACCESSIBILITY_LABEL}
              accessible
              resizeMode="contain"
              source={require('../../assets/smartpark-logo.png')}
              style={styles.logo}
            />
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
    height: 150,
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
