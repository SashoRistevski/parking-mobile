import { StyleSheet, View } from 'react-native';

import { useAuth } from '../../src/auth/AuthContext';
import { AppText } from '../../src/components/AppText';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { TextLink } from '../../src/components/TextLink';
import { useLocale } from '../../src/i18n/LocaleProvider';

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const { locale, setLocale, t } = useLocale();

  return (
    <Screen title={t('appName')}>
      <View style={styles.localeRow}>
        <Button
          title={t('macedonian')}
          variant={locale === 'mk' ? 'primary' : 'secondary'}
          onPress={() => setLocale('mk')}
        />
        <Button
          title={t('english')}
          variant={locale === 'en' ? 'primary' : 'secondary'}
          onPress={() => setLocale('en')}
        />
      </View>

      <AppText variant="muted" style={styles.signedInLabel}>
        {t('signedInAs')}
      </AppText>
      <Card style={styles.emailCard}>
        <AppText variant="label">{user?.email}</AppText>
      </Card>

      <View style={styles.section}>
        <AppText variant="label" style={styles.sectionTitle}>
          {t('laterPermissions')}
        </AppText>
        <TextLink href="/(app)/explain/location">{t('location')}</TextLink>
        <TextLink href="/(app)/explain/motion">{t('motion')}</TextLink>
        <TextLink href="/(app)/explain/notifications">
          {t('notifications')}
        </TextLink>
      </View>

      <Button title={t('logOut')} onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  localeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  signedInLabel: {
    marginBottom: 8,
  },
  emailCard: {
    marginBottom: 16,
  },
  section: {
    marginVertical: 16,
    gap: 8,
  },
  sectionTitle: {
    marginBottom: 4,
  },
});
