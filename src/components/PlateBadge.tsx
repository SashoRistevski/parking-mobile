import { StyleSheet, View } from 'react-native';

import { useInterLoaded } from '../theme/FontContext';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type PlateBadgeProps = {
  plate: string;
};

export function PlateBadge({ plate }: PlateBadgeProps) {
  const { colors } = useTheme();
  const interLoaded = useInterLoaded();

  return (
    <View style={[styles.badge, { borderColor: colors.primary }]}>
      <AppText
        style={[
          styles.text,
          {
            color: colors.text,
            fontFamily: interLoaded ? 'Inter_700Bold' : undefined,
            fontWeight: '800',
          },
        ]}
      >
        {plate}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 2,
    borderRadius: 7,
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 0.6,
  },
});
