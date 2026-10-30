import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { updateMe } from '../../src/api/auth';
import { ApiError, fieldErrorMessage } from '../../src/api/errors';
import { AppText } from '../../src/components/AppText';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { TextLink } from '../../src/components/TextLink';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { VehicleForm } from '../../src/vehicles/VehicleForm';

export default function SetupScreen() {
  const { t } = useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [phoneApiError, setPhoneApiError] = useState<ApiError | null>(null);

  const phoneFieldError = phoneApiError
    ? fieldErrorMessage(phoneApiError, 'phone_number')
    : undefined;

  const beforeCreateVehicle = useCallback(async () => {
    setPhoneApiError(null);
    try {
      const trimmed = phone.trim();
      await updateMe({ phone_number: trimmed ? trimmed : null });
    } catch (err) {
      if (err instanceof ApiError) {
        setPhoneApiError(err);
      }
      throw err;
    }
  }, [phone]);

  const onVehicleSaved = useCallback(() => {
    router.replace('/(app)');
  }, [router]);

  return (
    <Screen scroll includeTopInset={false}>
      <TextField
        autoComplete="tel"
        keyboardType="phone-pad"
        placeholder={t('phoneNumber')}
        textContentType="telephoneNumber"
        value={phone}
        onChangeText={setPhone}
      />
      {phoneFieldError ? (
        <AppText variant="body" style={{ color: colors.pay }}>
          {phoneFieldError}
        </AppText>
      ) : null}

      <View style={styles.vehicleForm}>
        <VehicleForm
          beforeCreate={beforeCreateVehicle}
          onSaved={onVehicleSaved}
        />
      </View>

      <View style={styles.later}>
        <TextLink href="/(app)">{t('later')}</TextLink>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  vehicleForm: {
    marginTop: 12,
  },
  later: {
    marginTop: 16,
  },
});
