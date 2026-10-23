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
  ...rest
}: TextFieldProps) {
  const { colors } = useTheme();
  const interLoaded = useInterLoaded();

  return (
    <TextInput
      placeholderTextColor={placeholderTextColor ?? colors.muted}
      style={[
        styles.input,
        {
          borderColor: colors.muted,
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
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});
