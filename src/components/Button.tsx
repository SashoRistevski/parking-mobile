import { Pressable, StyleSheet } from 'react-native';

import { useInterLoaded } from '../theme/FontContext';
import { lightColors } from '../theme/colors';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'pay' | 'text';

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
  const { colors } = useTheme();
  const interLoaded = useInterLoaded();

  let backgroundColor = colors.primary;
  let textColor = colors.textOnPrimary;
  let borderWidth = 0;
  let borderColor = colors.border;

  if (variant === 'secondary') {
    backgroundColor = colors.card;
    textColor = colors.navy;
    borderWidth = 1;
    borderColor = colors.border;
  } else if (variant === 'pay') {
    backgroundColor = colors.pay;
    textColor = lightColors.primary;
  } else if (variant === 'text') {
    backgroundColor = 'transparent';
    textColor = colors.primary600;
  }

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'text' ? styles.buttonText : null,
        {
          backgroundColor,
          borderWidth,
          borderColor,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <AppText
        variant="label"
        style={{
          color: textColor,
          textAlign: 'center',
          fontSize: 17,
          lineHeight: 22,
          fontFamily: interLoaded ? 'Inter_700Bold' : undefined,
        }}
      >
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 16,
    minHeight: 54,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    minHeight: undefined,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
});
