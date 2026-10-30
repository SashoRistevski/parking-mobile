import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SMS from 'expo-sms';

import { ApiError, displayErrorMessage } from '../../src/api/errors';
import {
  confirmSession,
  markCancelled,
  markSent,
  startSession,
  type CandidateZone,
  type ConfirmSessionStatus,
  type ParkingSessionZoneOperator,
  type SessionResult,
} from '../../src/api/sessions';
import { listVehicles, type Vehicle } from '../../src/api/vehicles';
import { createZoneReport } from '../../src/api/zoneReports';
import { AppText } from '../../src/components/AppText';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import type { ZoneFeature } from '../../src/detection/zone';
import { syncPrepaidExpiry } from '../../src/detection/prepaidExpiryScheduler';
import { syncGradskiClockEnd } from '../../src/detection/gradskiClockEndScheduler';
import { syncStillParked } from '../../src/detection/stillParkedScheduler';
import { PlateBadge } from '../../src/components/PlateBadge';
import { TextLink } from '../../src/components/TextLink';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { useInterLoaded } from '../../src/theme/FontContext';
import { lightColors } from '../../src/theme/colors';
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

type CachedZoneInfo = {
  code: string;
  name?: string;
  operatorShort?: string;
  paymentModel?: 'prepaid' | 'session';
};

type OverridePickerOption = {
  code: string;
  zoneId?: number;
  name?: string;
  operatorShort?: string;
};

function accuracyForZoneReport(accuracyM: number | null): number | undefined {
  if (accuracyM === null) {
    return undefined;
  }
  if (accuracyM >= 0 && accuracyM <= 100) {
    return accuracyM;
  }
  return undefined;
}

function findFeatureByCode(
  features: ZoneFeature[],
  code: string,
): ZoneFeature | undefined {
  const trimmed = code.trim();
  if (!trimmed) {
    return undefined;
  }
  const lower = trimmed.toLowerCase();
  return features.find((f) => f.properties.code.toLowerCase() === lower);
}

function buildOverridePickerOptions(
  features: ZoneFeature[],
): OverridePickerOption[] {
  const seen = new Set<string>();
  const out: OverridePickerOption[] = [];
  for (const feature of features) {
    const code = feature.properties.code;
    const key = code.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const props = feature.properties;
    out.push({
      code,
      zoneId: props.zone_id,
      name: props.name,
      operatorShort: props.operator?.short_name,
    });
  }
  return out;
}

function overridePickerLabel(option: OverridePickerOption): string {
  const parts = [option.code];
  if (option.name?.trim()) {
    parts.push(option.name.trim());
  }
  if (option.operatorShort?.trim()) {
    parts.push(option.operatorShort.trim());
  }
  return parts.join(' · ');
}

function cachedZoneFromFeature(feature: ZoneFeature): CachedZoneInfo {
  const props = feature.properties;
  const model = props.operator?.payment_model;
  const paymentModel =
    model === 'prepaid' || model === 'session' ? model : undefined;
  return {
    code: props.code,
    name: props.name,
    operatorShort: props.operator?.short_name,
    paymentModel,
  };
}

type SessionZoneInfo = {
  code: string | null;
  name: string;
  operator: ParkingSessionZoneOperator;
  paymentModel: string;
  paidUntilLocal: string | null;
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

function operatorShortName(
  operator: ParkingSessionZoneOperator | undefined,
): string | null {
  if (!operator) {
    return null;
  }
  if (typeof operator === 'string') {
    return operator.trim() || null;
  }
  const short = operator.short_name?.trim();
  return short || null;
}

function operatorLongName(
  operator: ParkingSessionZoneOperator | undefined,
): string | null {
  if (!operator || typeof operator === 'string') {
    return null;
  }
  const name = operator.name?.trim();
  return name || null;
}

function vehicleDetail(vehicle: Vehicle): string {
  const nick = vehicle.nickname?.trim();
  if (nick) {
    return nick;
  }
  return `${vehicle.vehicle_make} ${vehicle.vehicle_model}`.trim();
}

function formatPaidUntilLocal(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(parsed));
  }
  return value;
}

export default function PayScreen() {
  const { t } = useLocale();
  const { colors } = useTheme();
  const interLoaded = useInterLoaded();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    zoneCode?: string;
    zoneId?: string;
    paymentModel?: string;
    lat?: string;
    lng?: string;
    accuracyM?: string;
    override?: string;
  }>();

  const zoneCode = paramString(params.zoneCode) ?? '';
  const routeZoneId = parseOptionalInt(params.zoneId);
  const routePaymentModel = paymentModelFromRoute(
    paramString(params.paymentModel),
  );
  const routeLat = parseOptionalInt(params.lat);
  const routeLng = parseOptionalInt(params.lng);
  const routeAccuracyM = parseOptionalInt(params.accuracyM);
  const routeOverride = paramString(params.override) === '1';

  const [cachedZone, setCachedZone] = useState<CachedZoneInfo | null>(null);
  const [cachedPaymentModel, setCachedPaymentModel] = useState<
    'prepaid' | 'session' | null
  >(null);
  const [sessionZoneInfo, setSessionZoneInfo] = useState<SessionZoneInfo | null>(
    null,
  );
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
  const [vehiclesExpanded, setVehiclesExpanded] = useState(false);

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
  const [markingAlreadyPaid, setMarkingAlreadyPaid] = useState(false);

  const [overridePickerVisible, setOverridePickerVisible] =
    useState(routeOverride);
  const [overrideCodeInput, setOverrideCodeInput] = useState('');
  const [overrideWarning, setOverrideWarning] = useState<string | null>(null);
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [pickerFeatures, setPickerFeatures] = useState<ZoneFeature[]>([]);

  const idempotencyKeyRef = useRef<string | null>(null);
  const previewSessionIdRef = useRef<number | null>(null);
  const smsMarkedSentRef = useRef(false);
  const lastStartSignatureRef = useRef<string | null>(null);
  const closingRef = useRef(false);
  const cancelledSessionsRef = useRef<Set<number>>(new Set());

  const needsZoneCacheWait =
    zoneCode !== '' && routePaymentModel === null;
  const [zoneCacheReady, setZoneCacheReady] = useState(!needsZoneCacheWait);

  const requestCancelSession = useCallback((sessionId: number) => {
    if (cancelledSessionsRef.current.has(sessionId)) {
      return;
    }
    cancelledSessionsRef.current.add(sessionId);
    void markCancelled(sessionId);
  }, []);

  const effectivePaymentModel =
    sessionZoneInfo?.paymentModel === 'prepaid' ||
    sessionZoneInfo?.paymentModel === 'session'
      ? sessionZoneInfo.paymentModel
      : routePaymentModel ?? cachedPaymentModel;
  const showHourChips = effectivePaymentModel === 'prepaid';

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId],
  );

  const otherVehicles = useMemo(
    () => vehicles.filter((v) => v.id !== selectedVehicleId),
    [vehicles, selectedVehicleId],
  );

  const pickerOptions = useMemo(
    () => buildOverridePickerOptions(pickerFeatures),
    [pickerFeatures],
  );

  const canAutoStart =
    coords !== null &&
    !locationDenied &&
    !locating &&
    !vehiclesLoading &&
    zoneCacheReady &&
    selectedVehicleId !== null &&
    vehicles.length > 0 &&
    preview === null &&
    !preparing &&
    !(candidates && candidates.length > 0);

  const startSignature = useMemo(() => {
    if (!coords || selectedVehicleId === null) {
      return '';
    }
    return [
      selectedVehicleId,
      selectedHours,
      chosenZoneId ?? '',
      coords.lat,
      coords.lng,
      effectivePaymentModel ?? '',
    ].join('|');
  }, [
    coords,
    selectedVehicleId,
    selectedHours,
    chosenZoneId,
    effectivePaymentModel,
  ]);

  useEffect(() => {
    void (async () => {
      try {
        const cache = await loadZoneCache();
        setPickerFeatures(cache.features);
      } catch {
        // picker may stay empty
      }
    })();
  }, []);

  useEffect(() => {
    if (!zoneCode || routePaymentModel !== null) {
      return;
    }
    void (async () => {
      try {
        const cache = await loadZoneCache();
        setPickerFeatures(cache.features);
        const feature = cache.features.find((f) => f.properties.code === zoneCode);
        if (!feature) {
          return;
        }
        const props = feature.properties;
        const model = props.operator?.payment_model;
        const paymentModel =
          model === 'prepaid' || model === 'session' ? model : undefined;
        setCachedZone({
          code: props.code,
          name: props.name,
          operatorShort: props.operator?.short_name,
          paymentModel,
        });
        if (paymentModel) {
          setCachedPaymentModel(paymentModel);
        }
      } finally {
        setZoneCacheReady(true);
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

  useEffect(() => {
    smsMarkedSentRef.current = smsMarkedSent;
  }, [smsMarkedSent]);

  useEffect(() => {
    return () => {
      const sessionId = previewSessionIdRef.current;
      previewSessionIdRef.current = null;
      if (sessionId !== null && !smsMarkedSentRef.current) {
        requestCancelSession(sessionId);
      }
    };
  }, [requestCancelSession]);

  const abandonPreviewForReselect = useCallback(() => {
    const sessionId = previewSessionIdRef.current;
    previewSessionIdRef.current = null;
    setPreview(null);
    setSmsManualOnly(false);
    setSmsResultLine(null);
    setSmsMarkedSent(false);
    setOperatorConfirmAnswer(null);
    setConfirmingOperator(false);
    setSessionZoneInfo(null);
    lastStartSignatureRef.current = null;
    if (sessionId !== null) {
      requestCancelSession(sessionId);
    }
  }, [requestCancelSession]);

  const closeSheet = useCallback(() => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    const sessionId = previewSessionIdRef.current;
    previewSessionIdRef.current = null;
    if (sessionId !== null && !smsMarkedSentRef.current) {
      requestCancelSession(sessionId);
    }
    router.back();
  }, [requestCancelSession, router]);

  function onSelectVehicle(vehicle: Vehicle) {
    setVehiclesExpanded(false);
    if (smsMarkedSent) {
      return;
    }
    if (preview && selectedVehicleId !== vehicle.id) {
      abandonPreviewForReselect();
      idempotencyKeyRef.current = randomUUID();
    }
    setSelectedVehicleId(vehicle.id);
    setSelectedHours(defaultHoursForVehicle(vehicle));
    setCandidates(null);
    setError(null);
  }

  function onSelectHours(hours: number) {
    if (smsMarkedSent) {
      return;
    }
    if (preview && selectedHours !== hours) {
      abandonPreviewForReselect();
      idempotencyKeyRef.current = randomUUID();
    }
    setSelectedHours(hours);
    setError(null);
  }

  const applySessionResult = useCallback(
    async (result: SessionResult): Promise<boolean> => {
      const sessionId = result.data.id;
      const sms = result.sms;
      const zone = result.data.zone;
      setSessionZoneInfo({
        code: zone?.code ?? null,
        name: zone?.name ?? '',
        operator: zone?.operator ?? null,
        paymentModel: result.data.payment_model,
        paidUntilLocal: result.data.paid_until_local,
      });
      if (!sms || !sms.supported || !sms.recipient || !sms.body) {
        requestCancelSession(sessionId);
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
    },
    [requestCancelSession, t],
  );

  const runStart = useCallback(
    async (zoneId?: number) => {
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
        if (closingRef.current) {
          requestCancelSession(result.data.id);
          return;
        }
        setCandidates(null);
        if (zoneId !== undefined) {
          setChosenZoneId(zoneId);
        }
        await applySessionResult(result);
      } catch (err) {
        if (closingRef.current) {
          return;
        }
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
    },
    [
      coords,
      selectedVehicleId,
      effectivePaymentModel,
      selectedHours,
      applySessionResult,
      requestCancelSession,
    ],
  );

  useEffect(() => {
    if (!canAutoStart || !startSignature) {
      return;
    }
    if (lastStartSignatureRef.current === startSignature) {
      return;
    }
    lastStartSignatureRef.current = startSignature;
    idempotencyKeyRef.current = randomUUID();
    void runStart(chosenZoneId);
  }, [canAutoStart, startSignature, chosenZoneId, runStart]);

  const onConfirmOverride = useCallback(async () => {
    const trimmed = overrideCodeInput.trim().slice(0, 32);
    if (!trimmed || !coords) {
      return;
    }
    setOverrideSubmitting(true);
    setError(null);
    try {
      const accuracy = accuracyForZoneReport(coords.accuracyM);
      await createZoneReport({
        lat: coords.lat,
        lng: coords.lng,
        reported_zone_code: trimmed,
        reason: 'override',
        ...(accuracy !== undefined && { accuracy_m: accuracy }),
        ...(routeZoneId !== undefined && { detected_zone_id: routeZoneId }),
      });

      const feature = findFeatureByCode(pickerFeatures, trimmed);
      const zoneId = feature?.properties.zone_id;

      if (!feature || zoneId === undefined) {
        setOverrideWarning(t('payZoneNotOnMap'));
        setOverridePickerVisible(false);
        return;
      }

      setOverrideWarning(null);
      const zoneInfo = cachedZoneFromFeature(feature);
      setCachedZone(zoneInfo);
      if (zoneInfo.paymentModel) {
        setCachedPaymentModel(zoneInfo.paymentModel);
      }

      const overridePaymentModel =
        zoneInfo.paymentModel ?? routePaymentModel ?? cachedPaymentModel ?? '';
      const sig =
        selectedVehicleId !== null
          ? [
              selectedVehicleId,
              selectedHours,
              zoneId,
              coords.lat,
              coords.lng,
              overridePaymentModel,
            ].join('|')
          : '';

      if (preview) {
        abandonPreviewForReselect();
      }
      if (sig) {
        lastStartSignatureRef.current = sig;
      }
      idempotencyKeyRef.current = randomUUID();
      setChosenZoneId(zoneId);
      setOverridePickerVisible(false);
      setOverrideCodeInput('');
      await runStart(zoneId);
    } catch (err) {
      setError(displayErrorMessage(err));
    } finally {
      setOverrideSubmitting(false);
    }
  }, [
    overrideCodeInput,
    coords,
    routeZoneId,
    pickerFeatures,
    preview,
    abandonPreviewForReselect,
    runStart,
    t,
    selectedVehicleId,
    selectedHours,
    routePaymentModel,
    cachedPaymentModel,
  ]);

  async function onPickCandidate(zone: CandidateZone) {
    if (!coords || selectedVehicleId === null) {
      return;
    }
    const sig = [
      selectedVehicleId,
      selectedHours,
      zone.id,
      coords.lat,
      coords.lng,
      effectivePaymentModel ?? '',
    ].join('|');
    lastStartSignatureRef.current = sig;
    await runStart(zone.id);
  }

  const canAlreadyPaid =
    preview !== null &&
    !smsMarkedSent &&
    !preparing &&
    !(candidates && candidates.length > 0) &&
    !markingAlreadyPaid &&
    !openingSms;

  async function onAlreadyPaid() {
    if (!preview || !canAlreadyPaid) {
      return;
    }
    setMarkingAlreadyPaid(true);
    setError(null);
    try {
      const sent = await markSent(preview.sessionId);
      void syncPrepaidExpiry(sent.data);
      void syncGradskiClockEnd(sent.data);
      void syncStillParked(sent.data);
      try {
        await confirmSession(preview.sessionId, 'confirmed');
      } catch {
        // markSent succeeded; do not roll back or block close
      }
      smsMarkedSentRef.current = true;
      setSmsMarkedSent(true);
      closingRef.current = true;
      previewSessionIdRef.current = null;
      router.back();
    } catch (err) {
      setError(displayErrorMessage(err));
    } finally {
      setMarkingAlreadyPaid(false);
    }
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
        const sent = await markSent(preview.sessionId);
        void syncPrepaidExpiry(sent.data);
        void syncGradskiClockEnd(sent.data);
        void syncStillParked(sent.data);
        setSmsMarkedSent(true);
        setSmsResultLine(t('paySmsSent'));
      } else if (result === 'cancelled') {
        requestCancelSession(preview.sessionId);
        setSmsResultLine(t('paySmsCancelled'));
        setPreview(null);
        previewSessionIdRef.current = null;
        lastStartSignatureRef.current = null;
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

  const zoneCodeDisplay =
    sessionZoneInfo?.code?.trim() ||
    cachedZone?.code ||
    zoneCode ||
    '';
  const zoneName =
    sessionZoneInfo?.name?.trim() || cachedZone?.name?.trim() || '';
  const operatorShort =
    operatorShortName(sessionZoneInfo?.operator) ||
    cachedZone?.operatorShort ||
    null;
  const operatorLong = operatorLongName(sessionZoneInfo?.operator);

  const zoneTitleBase = zoneName
    ? zoneName
    : zoneCodeDisplay
      ? t('payZoneCode').replace('{code}', zoneCodeDisplay)
      : '';
  const zoneTitleLine =
    operatorShort && zoneTitleBase
      ? `${zoneTitleBase} · ${operatorShort}`
      : zoneTitleBase;

  const subtitleParts: string[] = [];
  if (operatorLong && operatorLong !== operatorShort) {
    subtitleParts.push(operatorLong);
  }
  if (effectivePaymentModel === 'prepaid') {
    subtitleParts.push(t('payPrepaidLabel'));
  }
  const zoneSubtitle = subtitleParts.join(' · ');

  const paidUntilDisplay =
    showHourChips && sessionZoneInfo?.paidUntilLocal
      ? formatPaidUntilLocal(sessionZoneInfo.paidUntilLocal)
      : null;

  function renderVehicleRow(vehicle: Vehicle) {
    return (
      <Pressable
        key={vehicle.id}
        accessibilityRole="button"
        onPress={() => void onSelectVehicle(vehicle)}
        style={[
          styles.vehicleRow,
          { borderColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <View style={styles.vehicleRowMain}>
          <PlateBadge plate={vehicle.formatted_plate} />
          <AppText
            numberOfLines={1}
            style={[
              styles.vehicleDetail,
              interLoaded ? { fontFamily: 'Inter_600SemiBold' } : undefined,
            ]}
          >
            {vehicleDetail(vehicle)}
          </AppText>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('payClose')}
        onPress={closeSheet}
        style={styles.scrim}
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.card,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <View style={styles.sheetHeader}>
          <AppText
            style={[
              styles.sheetTitle,
              interLoaded ? { fontFamily: 'Inter_700Bold' } : { fontWeight: '800' },
            ]}
          >
            {t('payTitle')}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('payClose')}
            onPress={closeSheet}
            style={[styles.closeButton, { backgroundColor: colors.background }]}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetContent}
          keyboardShouldPersistTaps="handled"
        >
          {zoneCodeDisplay || zoneTitleLine ? (
            <View style={styles.zoneRow}>
              <View
                style={[
                  styles.zoneBadge,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <AppText
                  style={[
                    styles.zoneBadgeText,
                    interLoaded
                      ? { fontFamily: 'Inter_700Bold' }
                      : { fontWeight: '800' },
                  ]}
                >
                  {zoneCodeDisplay}
                </AppText>
              </View>
              <View style={styles.zoneTextCol}>
                {zoneTitleLine ? (
                  <AppText
                    style={[
                      styles.zoneTitle,
                      interLoaded
                        ? { fontFamily: 'Inter_700Bold' }
                        : { fontWeight: '800' },
                    ]}
                  >
                    {zoneTitleLine}
                  </AppText>
                ) : null}
                {zoneSubtitle ? (
                  <AppText variant="muted">{zoneSubtitle}</AppText>
                ) : null}
              </View>
            </View>
          ) : null}

          {!overridePickerVisible ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setOverridePickerVisible(true)}
              style={styles.otherZoneLink}
            >
              <AppText
                style={[
                  styles.otherZoneLinkLabel,
                  { color: colors.primary600 },
                  interLoaded ? { fontFamily: 'Inter_600SemiBold' } : undefined,
                ]}
              >
                {t('mapOtherZone')}
              </AppText>
            </Pressable>
          ) : null}

          {overridePickerVisible ? (
            <View style={styles.gap}>
              <AppText variant="label">{t('payPickZone')}</AppText>
              {pickerOptions.map((option) => (
                <Pressable
                  key={option.code}
                  accessibilityRole="button"
                  onPress={() => setOverrideCodeInput(option.code)}
                  style={[
                    styles.candidateRow,
                    { borderColor: colors.border, backgroundColor: colors.card },
                  ]}
                >
                  <AppText>{overridePickerLabel(option)}</AppText>
                </Pressable>
              ))}
              <TextField
                value={overrideCodeInput}
                onChangeText={(text) => setOverrideCodeInput(text.slice(0, 32))}
                placeholder={t('payOverrideCodePlaceholder')}
                maxLength={32}
                autoCapitalize="characters"
                editable={!overrideSubmitting}
              />
              <Button
                title={t('payUseThisZone')}
                disabled={overrideSubmitting || !overrideCodeInput.trim()}
                onPress={() => void onConfirmOverride()}
              />
            </View>
          ) : null}

          {overrideWarning ? (
            <AppText variant="muted">{overrideWarning}</AppText>
          ) : null}

          {effectivePaymentModel === 'session' ? (
            <AppText variant="muted">{t('paySessionHint')}</AppText>
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
          ) : selectedVehicle ? (
            <View style={styles.gap}>
              <View
                style={[
                  styles.vehicleRow,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <View style={styles.vehicleRowMain}>
                  <PlateBadge plate={selectedVehicle.formatted_plate} />
                  <AppText
                    numberOfLines={1}
                    style={[
                      styles.vehicleDetail,
                      interLoaded
                        ? { fontFamily: 'Inter_600SemiBold' }
                        : undefined,
                    ]}
                  >
                    {vehicleDetail(selectedVehicle)}
                  </AppText>
                </View>
                {vehicles.length > 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setVehiclesExpanded((v) => !v)}
                  >
                    <AppText
                      style={[
                        styles.changeLink,
                        { color: colors.primary600 },
                        interLoaded
                          ? { fontFamily: 'Inter_600SemiBold' }
                          : undefined,
                      ]}
                    >
                      {t('payChange')}
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
              {vehiclesExpanded
                ? otherVehicles.map((vehicle) => renderVehicleRow(vehicle))
                : null}
            </View>
          ) : null}

          {showHourChips ? (
            <View style={styles.gap}>
              <AppText
                style={[
                  styles.hoursLabel,
                  interLoaded
                    ? { fontFamily: 'Inter_600SemiBold' }
                    : { fontWeight: '600' },
                ]}
              >
                {t('payHoursLabel')}
              </AppText>
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
                          borderColor: selected
                            ? colors.primary
                            : colors.border,
                          borderWidth: selected ? 2 : 1,
                          backgroundColor: selected
                            ? colors.primarySoft
                            : colors.card,
                        },
                      ]}
                    >
                      <AppText
                        style={[
                          interLoaded
                            ? {
                                fontFamily: selected
                                  ? 'Inter_700Bold'
                                  : 'Inter_600SemiBold',
                              }
                            : {
                                fontWeight: selected ? '800' : '600',
                              },
                        ]}
                      >
                        {hours} {t('hoursShort')}
                      </AppText>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {paidUntilDisplay ? (
                <AppText variant="muted">
                  {t('payPaidUntil').replace('{time}', paidUntilDisplay)}
                </AppText>
              ) : null}
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

          <View
            style={[styles.smsBox, { backgroundColor: colors.background }]}
          >
            {preparing && !preview ? (
              <AppText variant="muted">{t('paySmsLoading')}</AppText>
            ) : preview ? (
              <>
                <AppText variant="muted">
                  {t('paySmsTo').replace('{recipient}', preview.recipient)}
                </AppText>
                <AppText
                  selectable
                  style={[
                    styles.smsBody,
                    interLoaded
                      ? { fontFamily: 'Inter_700Bold' }
                      : { fontWeight: '700', fontFamily: 'monospace' },
                  ]}
                >
                  {preview.body}
                </AppText>
                {smsManualOnly ? (
                  <AppText variant="muted">{t('paySmsCopyHint')}</AppText>
                ) : null}
              </>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!preview || openingSms || smsMarkedSent}
            onPress={() => void onOpenSms()}
            style={({ pressed }) => [
              styles.openSmsButton,
              {
                backgroundColor: lightColors.primary,
                opacity:
                  !preview || openingSms || smsMarkedSent
                    ? 0.5
                    : pressed
                      ? 0.85
                      : 1,
              },
            ]}
          >
            <Ionicons
              name="chatbubble"
              size={20}
              color={lightColors.textOnPrimary}
              style={styles.openSmsIcon}
            />
            <AppText
              style={[
                styles.openSmsLabel,
                {
                  color: lightColors.textOnPrimary,
                  fontFamily: interLoaded ? 'Inter_700Bold' : undefined,
                },
              ]}
            >
              {t('payOpenSms')}
            </AppText>
          </Pressable>

          <AppText variant="muted" style={styles.disclaimer}>
            {t('payDisclaimer')}
          </AppText>

          <Pressable
            accessibilityRole="button"
            disabled={!canAlreadyPaid}
            onPress={() => void onAlreadyPaid()}
            style={styles.alreadyPaidButton}
          >
            <AppText
              style={[
                styles.alreadyPaidLabel,
                {
                  color: colors.primary600,
                  opacity: canAlreadyPaid ? 1 : 0.5,
                },
                interLoaded ? { fontFamily: 'Inter_600SemiBold' } : undefined,
              ]}
            >
              {t('payAlreadyPaid')}
            </AppText>
          </Pressable>

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
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(4, 29, 69, 0.45)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 22,
    lineHeight: 28,
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContent: {
    gap: 16,
    paddingBottom: 8,
  },
  gap: {
    gap: 10,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  zoneBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneBadgeText: {
    fontSize: 22,
    lineHeight: 26,
  },
  zoneTextCol: {
    flex: 1,
    gap: 2,
  },
  zoneTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  vehicleRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  vehicleDetail: {
    flex: 1,
    fontSize: 16,
  },
  changeLink: {
    fontSize: 15,
    marginLeft: 8,
  },
  hoursLabel: {
    fontSize: 15,
  },
  chipsRow: {
    gap: 8,
  },
  chip: {
    height: 48,
    minWidth: 56,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateRow: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  smsBox: {
    borderRadius: 14,
    padding: 14,
    gap: 8,
    minHeight: 72,
  },
  smsBody: {
    fontSize: 16,
    lineHeight: 22,
  },
  openSmsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 16,
  },
  openSmsIcon: {
    marginRight: 8,
  },
  openSmsLabel: {
    fontSize: 17,
    lineHeight: 22,
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  alreadyPaidButton: {
    alignSelf: 'center',
  },
  alreadyPaidLabel: {
    fontSize: 15,
    textAlign: 'center',
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
  },
  otherZoneLink: {
    alignSelf: 'flex-start',
  },
  otherZoneLinkLabel: {
    fontSize: 15,
  },
});
