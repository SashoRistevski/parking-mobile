import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { displayErrorMessage } from '../../../src/api/errors';
import {
  listVehicles,
  setDefaultVehicle,
  type Vehicle,
} from '../../../src/api/vehicles';
import { AppText } from '../../../src/components/AppText';
import { Card } from '../../../src/components/Card';
import { PlateBadge } from '../../../src/components/PlateBadge';
import { Screen } from '../../../src/components/Screen';
import { TextLink } from '../../../src/components/TextLink';
import { useInterLoaded } from '../../../src/theme/FontContext';
import { type TranslationKey } from '../../../src/i18n/catalogs';
import { useLocale } from '../../../src/i18n/LocaleProvider';
import { useTheme } from '../../../src/theme/ThemeProvider';

export default function VehiclesListScreen() {
  const { t } = useLocale();
  const { colors } = useTheme();
  const interLoaded = useInterLoaded();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingDefaultId, setSettingDefaultId] = useState<number | null>(
    null,
  );

  const loadVehicles = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await listVehicles();
      setVehicles(data);
    } catch (err) {
      setError(displayErrorMessage(err));
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      setError(null);
      setLoading(true);
      try {
        const data = await listVehicles();
        if (active) {
          setVehicles(data);
        }
      } catch (err) {
        if (active) {
          setError(displayErrorMessage(err));
          setVehicles([]);
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
  }, []);

  async function onSetDefault(id: number) {
    setSettingDefaultId(id);
    try {
      await setDefaultVehicle(id);
      await loadVehicles();
    } catch (err) {
      setError(displayErrorMessage(err));
    } finally {
      setSettingDefaultId(null);
    }
  }

  function formatPocHours(hours: number): string {
    return `${t('pocHoursLabel')}: ${hours} ${t('hoursShort')}`;
  }

  return (
    <Screen scroll>
      <View style={styles.headerRow}>
        <AppText
          style={[
            styles.screenTitle,
            {
              color: colors.text,
              fontFamily: interLoaded ? 'Inter_600SemiBold' : undefined,
              fontWeight: '800',
            },
          ]}
        >
          {t('vehicles')}
        </AppText>
        <Link href="/(app)/vehicles/new" asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('addVehicle')}
            style={({ pressed }) => [
              styles.addButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <AppText
              style={{
                color: colors.textOnPrimary,
                fontSize: 22,
                lineHeight: 24,
                fontFamily: interLoaded ? 'Inter_600SemiBold' : undefined,
              }}
            >
              +
            </AppText>
          </Pressable>
        </Link>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : null}

      {error ? (
        <AppText variant="body" style={{ color: colors.text, marginBottom: 16 }}>
          {error}
        </AppText>
      ) : null}

      {!loading && vehicles.length === 0 ? (
        <View style={styles.empty}>
          <AppText variant="body">{t('vehiclesEmpty')}</AppText>
          <TextLink href="/(app)/vehicles/new">{t('vehiclesEmptyAdd')}</TextLink>
        </View>
      ) : null}

      {!loading && vehicles.length > 0 ? (
        <View style={styles.list}>
          {vehicles.map((vehicle) => (
            <VehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              settingDefault={settingDefaultId === vehicle.id}
              onSetDefault={() => void onSetDefault(vehicle.id)}
              onOpen={() =>
                router.push({
                  pathname: '/(app)/vehicles/[id]',
                  params: { id: String(vehicle.id) },
                })
              }
              formatPocHours={formatPocHours}
              t={t}
              colors={colors}
              interLoaded={interLoaded}
            />
          ))}
          <AppText variant="muted" style={styles.help}>
            {t('vehiclesDefaultHelp')}
          </AppText>
        </View>
      ) : null}
    </Screen>
  );
}

type VehicleCardProps = {
  vehicle: Vehicle;
  settingDefault: boolean;
  onSetDefault: () => void;
  onOpen: () => void;
  formatPocHours: (hours: number) => string;
  t: (key: TranslationKey) => string;
  colors: ReturnType<typeof useTheme>['colors'];
  interLoaded: boolean;
};

function VehicleCard({
  vehicle,
  settingDefault,
  onSetDefault,
  onOpen,
  formatPocHours,
  t,
  colors,
  interLoaded,
}: VehicleCardProps) {
  const isDefault = vehicle.is_default;
  const makeModel = `${vehicle.vehicle_make} · ${vehicle.vehicle_model}`;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
    >
      <Card
        style={{
          ...styles.vehicleCard,
          ...(isDefault
            ? { borderWidth: 2, borderColor: colors.primary600 }
            : { borderWidth: 0 }),
        }}
      >
        <View style={styles.cardTopRow}>
          <PlateBadge plate={vehicle.formatted_plate} />
          {isDefault ? (
            <View
              style={[
                styles.defaultPill,
                { backgroundColor: colors.primarySoft },
              ]}
            >
              <AppText
                style={[
                  styles.defaultPillText,
                  {
                    color: colors.primary,
                    fontFamily: interLoaded ? 'Inter_700Bold' : undefined,
                  },
                ]}
              >
                {t('defaultVehicle')}
              </AppText>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={settingDefault}
              onPress={onSetDefault}
              style={({ pressed }) => [
                styles.setDefaultButton,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  opacity: settingDefault ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <AppText
                style={[
                  styles.setDefaultText,
                  {
                    color: colors.text,
                    fontFamily: interLoaded ? 'Inter_600SemiBold' : undefined,
                  },
                ]}
              >
                {t('setAsDefault')}
              </AppText>
            </Pressable>
          )}
        </View>
        <View style={styles.cardBottomRow}>
          <AppText
            variant="body"
            style={[
              styles.makeModel,
              {
                fontFamily: interLoaded ? 'Inter_600SemiBold' : undefined,
              },
            ]}
          >
            {makeModel}
          </AppText>
          {typeof vehicle.default_park_time === 'number' ? (
            <AppText variant="muted" style={styles.pocHours}>
              {formatPocHours(vehicle.default_park_time)}
            </AppText>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: -8,
  },
  screenTitle: {
    fontSize: 32,
    lineHeight: 38,
    flex: 1,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginVertical: 24,
  },
  empty: {
    gap: 12,
  },
  list: {
    gap: 12,
  },
  help: {
    marginTop: 4,
    marginHorizontal: 4,
    fontSize: 13,
    lineHeight: 19,
  },
  vehicleCard: {
    gap: 14,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  makeModel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  pocHours: {
    fontSize: 15,
    lineHeight: 20,
  },
  defaultPill: {
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  defaultPillText: {
    fontSize: 12,
    lineHeight: 16,
  },
  setDefaultButton: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setDefaultText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
