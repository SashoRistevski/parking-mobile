import { Pressable, StyleSheet } from 'react-native';

import { useInterLoaded } from '../theme/FontContext';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'pay';

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
};

export function Button({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
}: ButtonProps) {
  const { colors, isDark } = useTheme();
  const interLoaded = useInterLoaded();

  let backgroundColor = colors.primary;
  let textColor = colors.textOnPrimary;

  if (variant === 'secondary') {
    backgroundColor = isDark ? colors.card : colors.brandSoft;
    textColor = isDark ? colors.primary : colors.navy;
  } else if (variant === 'pay') {
    backgroundColor = colors.pay;
    textColor = colors.textOnPrimary;
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <AppText
        variant="label"
        style={{
          color: textColor,
          textAlign: 'center',
          fontFamily: interLoaded ? 'Inter_600SemiBold' : undefined,
        }}
      >
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
});
