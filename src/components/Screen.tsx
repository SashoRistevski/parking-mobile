import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  SafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type ScreenProps = {
  children: ReactNode;
  title?: string;
  scroll?: boolean;
  /** When false, omits top safe-area padding (e.g. screens under a stack header). */
  includeTopInset?: boolean;
};

export function Screen({
  children,
  title,
  scroll = false,
  includeTopInset = true,
}: ScreenProps) {
  const { colors } = useTheme();

  const content = (
    <>
      {title ? (
        <AppText variant="title" style={styles.title}>
          {title}
        </AppText>
      ) : null}
      {children}
    </>
  );

  const edges: Edge[] = includeTopInset
    ? ['top', 'left', 'right', 'bottom']
    : ['left', 'right', 'bottom'];

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={edges}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        <View style={styles.content}>{content}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 24,
  },
  title: {
    marginBottom: 24,
  },
});
