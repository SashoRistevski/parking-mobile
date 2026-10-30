import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { displayErrorMessage } from '../../../src/api/errors';
import { listVehicles, type Vehicle } from '../../../src/api/vehicles';
import { AppText } from '../../../src/components/AppText';
import { Button } from '../../../src/components/Button';
import { Screen } from '../../../src/components/Screen';
import { useLocale } from '../../../src/i18n/LocaleProvider';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { VehicleForm } from '../../../src/vehicles/VehicleForm';

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const vehicleId = Number.parseInt(id ?? '', 10);
  const invalidId = !Number.isFinite(vehicleId);

  useEffect(() => {
    if (invalidId) {
      return;
    }

    let active = true;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const vehicles = await listVehicles();
        const match = vehicles.find((item) => item.id === vehicleId);
        if (!active) {
          return;
        }
        if (!match) {
          setError(t('vehicleNotFound'));
          setVehicle(null);
        } else {
          setVehicle(match);
        }
      } catch (err) {
        if (active) {
          setError(displayErrorMessage(err));
          setVehicle(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [vehicleId, invalidId, t]);

  if (invalidId) {
    return (
      <Screen scroll includeTopInset={false}>
        <View style={styles.errorBlock}>
          <AppText variant="body" style={{ color: colors.pay }}>
            {t('vehicleNotFound')}
          </AppText>
          <Button title={t('back')} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen includeTopInset={false}>
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </Screen>
    );
  }

  if (error || !vehicle) {
    return (
      <Screen scroll includeTopInset={false}>
        <View style={styles.errorBlock}>
          <AppText variant="body" style={{ color: colors.pay }}>
            {error ?? t('vehicleNotFound')}
          </AppText>
          <Button title={t('back')} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll includeTopInset={false}>
      <VehicleForm
        vehicleId={vehicle.id}
        initialValues={{
          vehicle_make: vehicle.vehicle_make,
          vehicle_model: vehicle.vehicle_model,
          license_plate: vehicle.formatted_plate,
          nickname: vehicle.nickname ?? '',
          default_park_time:
            typeof vehicle.default_park_time === 'number'
              ? String(vehicle.default_park_time)
              : '',
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginVertical: 24,
  },
  errorBlock: {
    gap: 16,
  },
});
