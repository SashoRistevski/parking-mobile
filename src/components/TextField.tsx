import { useState } from 'react';
import {
  TextInput,
  type TextInputProps,
  StyleSheet,
} from 'react-native';

import { useInterLoaded } from '../theme/FontContext';
import { useTheme } from '../theme/ThemeProvider';

type TextFieldProps = TextInputProps;

export function TextField({
  style,
  placeholderTextColor,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const { colors } = useTheme();
  const interLoaded = useInterLoaded();
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      placeholderTextColor={placeholderTextColor ?? colors.muted}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        styles.input,
        {
          borderColor: focused ? colors.accent : colors.border,
          borderWidth: focused ? 2 : 1,
          backgroundColor: colors.card,
          color: colors.text,
          fontFamily: interLoaded ? 'Inter_400Regular' : undefined,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});
