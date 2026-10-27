import { Link, type LinkProps } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type TextLinkProps = LinkProps & {
  children: string;
};

export function TextLink({ children, style, ...rest }: TextLinkProps) {
  const { colors } = useTheme();

  return (
    <Link {...rest} style={style}>
      <AppText variant="body" style={[styles.link, { color: colors.primary600 }]}>
        {children}
      </AppText>
    </Link>
  );
}

const styles = StyleSheet.create({
  link: {
    textDecorationLine: 'underline',
  },
});
