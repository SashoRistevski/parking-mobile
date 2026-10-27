import { type ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

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
};

export function AuthScreen({
  title,
  children,
  showBrandLogo = false,
  showAppName = false,
  appName,
}: AuthScreenProps) {
  const { colors } = useTheme();

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {showBrandLogo ? (
          <Image
            accessibilityLabel={LOGO_ACCESSIBILITY_LABEL}
            accessible
            resizeMode="contain"
            source={require('../../assets/smartpark-logo.png')}
            style={styles.logo}
          />
        ) : null}
        {showAppName && appName ? (
          <AppText variant="title" style={styles.appName}>
            {appName}
          </AppText>
        ) : null}
        <AppText variant="title" style={showBrandLogo ? styles.titleBelowLogo : undefined}>
          {title}
        </AppText>
        <View style={styles.form}>{children}</View>
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
  logo: {
    width: 168,
    height: 150,
    alignSelf: 'center',
    marginBottom: 14,
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
});
