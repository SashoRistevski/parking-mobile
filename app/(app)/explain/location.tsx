import { AppText } from '../../../src/components/AppText';
import { Screen } from '../../../src/components/Screen';
import { useLocale } from '../../../src/i18n/LocaleProvider';

export default function LocationExplainScreen() {
  const { t } = useLocale();

  return (
    <Screen scroll includeTopInset={false}>
      <AppText>{t('explainLocation')}</AppText>
    </Screen>
  );
}
