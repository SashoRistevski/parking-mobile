import { Text, type TextProps, type TextStyle } from 'react-native';

import { useInterLoaded } from '../theme/FontContext';
import { useTheme } from '../theme/ThemeProvider';

export type AppTextVariant = 'title' | 'body' | 'label' | 'muted';

type AppTextProps = TextProps & {
  variant?: AppTextVariant;
};

const variantStyles: Record<
  AppTextVariant,
  Pick<TextStyle, 'fontSize' | 'lineHeight' | 'fontFamily'>
> = {
  title: { fontSize: 28, lineHeight: 34 },
  body: { fontSize: 16, lineHeight: 24 },
  label: { fontSize: 14, lineHeight: 20 },
  muted: { fontSize: 14, lineHeight: 20 },
};

function fontFamilyForVariant(
  variant: AppTextVariant,
  interLoaded: boolean,
): string | undefined {
  if (!interLoaded) {
    return undefined;
  }
  if (variant === 'title') {
    return 'Inter_600SemiBold';
  }
  if (variant === 'label') {
    return 'Inter_500Medium';
  }
  return 'Inter_400Regular';
}

export function AppText({
  variant = 'body',
  style,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  const interLoaded = useInterLoaded();
  const color =
    variant === 'muted' ? colors.muted : colors.text;

  return (
    <Text
      style={[
        {
          textAlign: 'left',
          color,
          fontFamily: fontFamilyForVariant(variant, interLoaded),
          ...variantStyles[variant],
        },
        style,
      ]}
      {...rest}
    />
  );
}
