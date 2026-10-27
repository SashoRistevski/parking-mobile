import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as SMS from 'expo-sms';

import { ApiError, displayErrorMessage } from '../../src/api/errors';
import {
  confirmSession,
  markCancelled,
  markSent,
  startSession,
  type CandidateZone,
  type ConfirmSessionStatus,
  type SessionResult,
} from '../../src/api/sessions';
import { listVehicles, type Vehicle } from '../../src/api/vehicles';
import { AppText } from '../../src/components/AppText';
import { Button } from '../../src/components/Button';
import { PlateBadge } from '../../src/components/PlateBadge';
import { Screen } from '../../src/components/Screen';
import { TextLink } from '../../src/components/TextLink';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { loadZoneCache } from '../../src/zones/cache';

type Coords = {
  lat: number;
  lng: number;
  accuracyM: number | null;
};

type SmsPreview = {
  sessionId: number;
  recipient: string;
  body: string;
};

function paramString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseOptionalInt(
  value: string | string[] | undefined,
): number | undefined {
  const raw = paramString(value);
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function candidateLabel(zone: CandidateZone): string {
  const display = zone.display_name?.trim();
  if (display) {
    return display;
  }
  const name = zone.name?.trim();
  if (name) {
    return name;
  }
  return zone.code ?? String(zone.id);
}

function paymentModelFromRoute(
  value: string | undefined,
): 'prepaid' | 'session' | null {
  if (value === 'prepaid' || value === 'session') {
    return value;
  }
  return null;
}

function defaultHoursForVehicle(vehicle: Vehicle | undefined): number {
  const hours = vehicle?.default_park_time;
  if (hours !== null && hours !== undefined && hours >= 1 && hours <= 24) {
    return hours;
  }
  return 1;
}

export default function PayScreen() {
  const { t } = useLocale();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    zoneCode?: string;
    zoneId?: string;
    paymentModel?: string;
    lat?: string;
    lng?: string;
    accuracyM?: string;
  }>();

  const zoneCode = paramString(params.zoneCode) ?? '';
  const routeZoneId = parseOptionalInt(params.zoneId);
  const routePaymentModel = paymentModelFromRoute(
    paramString(params.paymentModel),
  );
  const routeLat = parseOptionalInt(params.lat);
  const routeLng = parseOptionalInt(params.lng);
  const routeAccuracyM = parseOptionalInt(params.accuracyM);

  const [cachedPaymentModel, setCachedPaymentModel] = useState<
    'prepaid' | 'session' | null
  >(null);
  const [coords, setCoords] = useState<Coords | null>(
    routeLat !== undefined && routeLng !== undefined
      ? {
          lat: routeLat,
          lng: routeLng,
          accuracyM: routeAccuracyM ?? null,
        }
      : null,
  );
  const [locationDenied, setLocationDenied] = useState(false);
  const [locating, setLocating] = useState(
    routeLat === undefined || routeLng === undefined,
  );

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    null,
  );
  const [selectedHours, setSelectedHours] = useState(1);

  const [candidates, setCandidates] = useState<CandidateZone[] | null>(null);
  const [chosenZoneId, setChosenZoneId] = useState<number | undefined>(
    routeZoneId,
  );
  const [preview, setPreview] = useState<SmsPreview | null>(null);
  const [smsManualOnly, setSmsManualOnly] = useState(false);
  const [smsResultLine, setSmsResultLine] = useState<string | null>(null);
  const [smsMarkedSent, setSmsMarkedSent] = useState(false);
  const [operatorConfirmAnswer, setOperatorConfirmAnswer] =
    useState<ConfirmSessionStatus | null>(null);
  const [confirmingOperator, setConfirmingOperator] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [openingSms, setOpeningSms] = useState(false);

  const idempotencyKeyRef = useRef<string | null>(null);
  const previewSessionIdRef = useRef<number | null>(null);

  const effectivePaymentModel = routePaymentModel ?? cachedPaymentModel;
  const showHourChips = effectivePaymentModel === 'prepaid';

  const canPost =
    coords !== null &&
    !locationDenied &&
    selectedVehicleId !== null &&
    vehicles.length > 0 &&
    preview === null;

  useEffect(() => {
    if (routePaymentModel !== null || !zoneCode) {
      return;
    }
    void (async () => {
      const cache = await loadZoneCache();
      const feature = cache.features.find((f) => f.properties.code === zoneCode);
      const model = feature?.properties.operator?.payment_model;
      if (model === 'prepaid' || model === 'session') {
        setCachedPaymentModel(model);
      }
    })();
  }, [routePaymentModel, zoneCode]);

  useEffect(() => {
    if (routeLat !== undefined && routeLng !== undefined) {
      return;
    }
    void (async () => {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        setLocationDenied(true);
        setLocating(false);
        return;
      }
      try {
        const fix = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCoords({
          lat: fix.coords.latitude,
          lng: fix.coords.longitude,
          accuracyM: fix.coords.accuracy ?? null,
        });
      } catch {
        setError(t('payLocationFailed'));
      } finally {
        setLocating(false);
      }
    })();
  }, [routeLat, routeLng, t]);

  useEffect(() => {
    void (async () => {
      setVehiclesLoading(true);
      setError(null);
      try {
        const data = await listVehicles();
        setVehicles(data);
        const defaultVehicle = data.find((v) => v.is_default) ?? data[0];
        if (defaultVehicle) {
          setSelectedVehicleId(defaultVehicle.id);
          setSelectedHours(defaultHoursForVehicle(defaultVehicle));
        }
      } catch (err) {
        setError(displayErrorMessage(err));
        setVehicles([]);
      } finally {
        setVehiclesLoading(false);
      }
    })();
  }, []);

  const clearPreviewLocal = useCallback(() => {
    previewSessionIdRef.current = null;
    setPreview(null);
    setSmsManualOnly(false);
    setSmsResultLine(null);
    setSmsMarkedSent(false);
    setOperatorConfirmAnswer(null);
    setConfirmingOperator(false);
  }, []);

  const clearPreview = useCallback(async () => {
    const sessionId = previewSessionIdRef.current;
    previewSessionIdRef.current = null;
    setPreview(null);
    setSmsManualOnly(false);
    setSmsResultLine(null);
    setSmsMarkedSent(false);
    setOperatorConfirmAnswer(null);
    setConfirmingOperator(false);
    if (sessionId !== null) {
      try {
        await markCancelled(sessionId);
      } catch {
        // ignore
      }
    }
  }, []);

  async function onSelectVehicle(vehicle: Vehicle) {
    if (preview && selectedVehicleId !== vehicle.id) {
      if (smsMarkedSent) {
        clearPreviewLocal();
      } else {
        await clearPreview();
      }
    }
    setSelectedVehicleId(vehicle.id);
    setSelectedHours(defaultHoursForVehicle(vehicle));
    setCandidates(null);
    setError(null);
  }

  async function onSelectHours(hours: number) {
    if (preview && selectedHours !== hours) {
      if (smsMarkedSent) {
        clearPreviewLocal();
      } else {
        await clearPreview();
      }
    }
    setSelectedHours(hours);
    setError(null);
  }

  async function applySessionResult(result: SessionResult): Promise<boolean> {
    const sessionId = result.data.id;
    const sms = result.sms;
    if (!sms || !sms.supported || !sms.recipient || !sms.body) {
      try {
        await markCancelled(sessionId);
      } catch {
        // ignore
      }
      setError(sms?.reason ?? t('paySmsMissing'));
      return false;
    }
    previewSessionIdRef.current = sessionId;
    setPreview({
      sessionId,
      recipient: sms.recipient,
      body: sms.body,
    });
    setSmsManualOnly(false);
    setSmsResultLine(null);
    setSmsMarkedSent(false);
    setOperatorConfirmAnswer(null);
    setConfirmingOperator(false);
    return true;
  }

  async function runStart(zoneId?: number) {
    if (!coords || selectedVehicleId === null) {
      return;
    }
    const key = idempotencyKeyRef.current ?? randomUUID();
    idempotencyKeyRef.current = key;

    const body = {
      vehicle_id: selectedVehicleId,
      lat: coords.lat,
      lng: coords.lng,
      ...(coords.accuracyM !== null && { accuracy_m: coords.accuracyM }),
      ...(zoneId !== undefined && { zone_id: zoneId }),
      ...(effectivePaymentModel === 'prepaid' && { hours: selectedHours }),
    };

    setPreparing(true);
    setError(null);
    try {
      const result = await startSession(body, { idempotencyKey: key });
      setCandidates(null);
      if (zoneId !== undefined) {
        setChosenZoneId(zoneId);
      }
      await applySessionResult(result);
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 422 &&
        err.candidates &&
        err.candidates.length > 0
      ) {
        setCandidates(err.candidates);
        return;
      }
      setError(displayErrorMessage(err));
    } finally {
      setPreparing(false);
    }
  }

  async function onPrepare() {
    setCandidates(null);
    idempotencyKeyRef.current = randomUUID();
    await runStart(chosenZoneId);
  }

  async function onPickCandidate(zone: CandidateZone) {
    await runStart(zone.id);
  }

  async function onOpenSms() {
    if (!preview) {
      return;
    }
    setOpeningSms(true);
    setSmsResultLine(null);
    try {
      const available = await SMS.isAvailableAsync();
      if (!available) {
        setSmsManualOnly(true);
        return;
      }
      const { result } = await SMS.sendSMSAsync(
        [preview.recipient],
        preview.body,
      );
      if (result === 'sent') {
        await markSent(preview.sessionId);
        setSmsMarkedSent(true);
        setSmsResultLine(t('paySmsSent'));
      } else if (result === 'cancelled') {
        await markCancelled(preview.sessionId);
        setSmsResultLine(t('paySmsCancelled'));
        setPreview(null);
        previewSessionIdRef.current = null;
      } else {
        setSmsResultLine(t('paySmsUnknown'));
      }
    } catch (err) {
      setError(displayErrorMessage(err));
    } finally {
      setOpeningSms(false);
    }
  }

  async function onOperatorConfirm(status: ConfirmSessionStatus) {
    if (!preview || !smsMarkedSent || confirmingOperator) {
      return;
    }
    setConfirmingOperator(true);
    try {
      await confirmSession(preview.sessionId, status);
      setOperatorConfirmAnswer(status);
    } catch (err) {
      setError(displayErrorMessage(err));
    } finally {
      setConfirmingOperator(false);
    }
  }

  const hourOptions = useMemo(
    () => Array.from({ length: 24 }, (_, i) => i + 1),
    [],
  );

  return (
    <Screen scroll includeTopInset={false}>
      <View style={styles.block}>
        {zoneCode ? (
          <AppText variant="title">{zoneCode}</AppText>
        ) : null}

        {locating ? (
          <ActivityIndicator color={colors.primary} />
        ) : null}

        {locationDenied ? (
          <AppText style={{ color: colors.pay }}>{t('payLocationDenied')}</AppText>
        ) : null}

        {error ? (
          <AppText style={{ color: colors.pay }}>{error}</AppText>
        ) : null}

        {vehiclesLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : vehicles.length === 0 ? (
          <View style={styles.gap}>
            <AppText>{t('payNoVehicles')}</AppText>
            <TextLink href="/(app)/vehicles/new">{t('vehiclesEmptyAdd')}</TextLink>
          </View>
        ) : (
          <View style={styles.gap}>
            <AppText variant="label">{t('payPickVehicle')}</AppText>
            {vehicles.map((vehicle) => {
              const selected = vehicle.id === selectedVehicleId;
              return (
                <Pressable
                  key={vehicle.id}
                  accessibilityRole="button"
                  onPress={() => void onSelectVehicle(vehicle)}
                  style={[
                    styles.vehicleRow,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                >
                  <PlateBadge plate={vehicle.formatted_plate} />
                  {vehicle.is_default ? (
                    <AppText variant="muted">{t('defaultVehicle')}</AppText>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}

        {effectivePaymentModel === 'session' ? (
          <AppText>{t('paySessionHint')}</AppText>
        ) : null}

        {showHourChips ? (
          <View style={styles.gap}>
            <AppText variant="label">{t('payHoursLabel')}</AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {hourOptions.map((hours) => {
                const selected = hours === selectedHours;
                return (
                  <Pressable
                    key={hours}
                    accessibilityRole="button"
                    onPress={() => void onSelectHours(hours)}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected
                          ? colors.primarySoft
                          : colors.card,
                      },
                    ]}
                  >
                    <AppText variant={selected ? 'label' : 'body'}>
                      {hours} {t('hoursShort')}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {candidates && candidates.length > 0 ? (
          <View style={styles.gap}>
            <AppText variant="label">{t('payPickZone')}</AppText>
            {candidates.map((zone) => (
              <Pressable
                key={zone.id}
                accessibilityRole="button"
                onPress={() => void onPickCandidate(zone)}
                style={[
                  styles.candidateRow,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <AppText>{candidateLabel(zone)}</AppText>
              </Pressable>
            ))}
          </View>
        ) : null}

        {preview ? (
          <View style={styles.gap}>
            <AppText variant="label">{t('paySmsPreview')}</AppText>
            <AppText selectable>{preview.recipient}</AppText>
            <AppText selectable>{preview.body}</AppText>
            {smsManualOnly ? (
              <AppText variant="muted">{t('paySmsCopyHint')}</AppText>
            ) : null}
            <Button
              title={t('payOpenSms')}
              variant="pay"
              disabled={openingSms || smsMarkedSent}
              onPress={() => void onOpenSms()}
            />
            {smsResultLine ? <AppText>{smsResultLine}</AppText> : null}
            {smsMarkedSent && operatorConfirmAnswer === null ? (
              <View style={styles.gap}>
                <AppText>{t('payOperatorConfirmQuestion')}</AppText>
                <View style={styles.confirmRow}>
                  <View style={styles.confirmButton}>
                    <Button
                      title={t('payConfirmYes')}
                      disabled={confirmingOperator}
                      onPress={() => void onOperatorConfirm('confirmed')}
                    />
                  </View>
                  <View style={styles.confirmButton}>
                    <Button
                      title={t('payConfirmNo')}
                      variant="secondary"
                      disabled={confirmingOperator}
                      onPress={() => void onOperatorConfirm('failed')}
                    />
                  </View>
                </View>
              </View>
            ) : null}
            {operatorConfirmAnswer === 'confirmed' ? (
              <AppText>{t('payConfirmResultConfirmed')}</AppText>
            ) : null}
            {operatorConfirmAnswer === 'failed' ? (
              <AppText>{t('payConfirmResultFailed')}</AppText>
            ) : null}
          </View>
        ) : (
          <Button
            title={preparing ? t('payPreparing') : t('payPrepare')}
            disabled={!canPost || preparing || vehiclesLoading}
            onPress={() => void onPrepare()}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 20,
  },
  gap: {
    gap: 12,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  candidateRow: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
  },
});
