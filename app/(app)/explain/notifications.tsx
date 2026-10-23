import { AppText } from '../../../src/components/AppText';
import { Screen } from '../../../src/components/Screen';
import { useLocale } from '../../../src/i18n/LocaleProvider';

export default function NotificationsExplainScreen() {
  const { t } = useLocale();

  return (
    <Screen scroll includeTopInset={false}>
      <AppText>{t('explainNotifications')}</AppText>
    </Screen>
  );
}
