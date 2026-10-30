import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SMS from 'expo-sms';

import { displayErrorMessage } from '../../src/api/errors';
import {
  extendSession,
  getActiveSessions,
  markSent,
  stopSession,
  type ParkingSession,
  type ParkingSessionZoneOperator,
  type SessionResult,
} from '../../src/api/sessions';
import { listVehicles, type Vehicle } from '../../src/api/vehicles';
import { AppText } from '../../src/components/AppText';
import { Button } from '../../src/components/Button';
import type { ZoneFeature } from '../../src/detection/zone';
import { syncPrepaidExpiry } from '../../src/detection/prepaidExpiryScheduler';
import { syncGradskiClockEnd } from '../../src/detection/gradskiClockEndScheduler';
import { syncStillParked } from '../../src/detection/stillParkedScheduler';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { useInterLoaded } from '../../src/theme/FontContext';
import { lightColors } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/ThemeProvider';
import { loadZoneCache, paidEndsAt } from '../../src/zones/cache';

function paramString(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseSessionId(
  value: string | string[] | undefined,
): number | undefined {
  const raw = paramString(value);
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function isPrepaid(session: ParkingSession): boolean {
  return session.payment_model === 'prepaid';
}

function sessionShown(
  sessions: ParkingSession[],
  routeSessionId: number | undefined,
): ParkingSession | null {
  if (sessions.length === 0) {
    return null;
  }
  if (routeSessionId !== undefined) {
    const match = sessions.find((s) => s.id === routeSessionId);
    if (match) {
      return match;
    }
  }
  return sessions[0];
}

function formatClockFromIso(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(parsed));
  }
  const match = value.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  return value;
}

function formatElapsed(startedAt: string, nowMs: number): string {
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) {
    return '0:00';
  }
  const diffMs = Math.max(0, nowMs - start);
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

function formatCountdown(
  paidUntilLocal: string | null,
  nowMs: number,
): string {
  if (!paidUntilLocal) {
    return '0:00';
  }
  const end = Date.parse(paidUntilLocal);
  if (Number.isNaN(end)) {
    return paidUntilLocal;
  }
  const diffMs = end - nowMs;
  if (diffMs <= 0) {
    return '0:00';
  }
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}`;
}

function operatorLineLabel(
  operator: ParkingSessionZoneOperator | undefined,
): string | null {
  if (!operator) {
    return null;
  }
  if (typeof operator === 'string') {
    const trimmed = operator.trim();
    return trimmed || null;
  }
  const name = operator.name?.trim();
  if (name) {
    return name;
  }
  const short = operator.short_name?.trim();
  return short || null;
}

function findFeatureByCode(
  features: ZoneFeature[],
  code: string | null,
): ZoneFeature | undefined {
  if (!code) {
    return undefined;
  }
  return features.find((f) => f.properties.code === code);
}

async function openSmsFromResult(
  result: SessionResult,
  onUnavailable: (recipient: string, body: string) => void,
): Promise<'sent' | 'cancelled' | 'unknown' | 'unavailable' | 'missing'> {
  const sms = result.sms;
  if (!sms) {
    return 'missing';
  }
  if (!sms.supported || !sms.recipient || !sms.body) {
    return 'missing';
  }
  const available = await SMS.isAvailableAsync();
  if (!available) {
    onUnavailable(sms.recipient, sms.body);
    return 'unavailable';
  }
  const { result: sendResult } = await SMS.sendSMSAsync(
    [sms.recipient],
    sms.body,
  );
  if (sendResult === 'sent') {
    return 'sent';
  }
  if (sendResult === 'cancelled') {
    return 'cancelled';
  }
  return 'unknown';
}

export default function SessionScreen() {
  const { t } = useLocale();
  const { colors } = useTheme();
  const interLoaded = useInterLoaded();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const routeSessionId = parseSessionId(params.sessionId);

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [features, setFeatures] = useState<ZoneFeature[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [smsManual, setSmsManual] = useState<{
    recipient: string;
    body: string;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const session = useMemo(() => {
    if (sessions.length === 0) {
      return null;
    }
    if (routeSessionId !== undefined) {
      const match = sessions.find((s) => s.id === routeSessionId);
      if (match) {
        return match;
      }
    }
    return sessions[0];
  }, [sessions, routeSessionId]);

  const plate = useMemo(() => {
    if (!session) {
      return null;
    }
    const vehicle = vehicles.find((v) => v.id === session.vehicle_id);
    return vehicle?.formatted_plate ?? null;
  }, [session, vehicles]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [active, vehicleList, cache] = await Promise.all([
          getActiveSessions(),
          listVehicles(),
          loadZoneCache(),
        ]);
        if (cancelled) {
          return;
        }
        setSessions(active);
        setVehicles(vehicleList);
        setFeatures(cache.features);
      } catch (err) {
        if (!cancelled) {
          setError(displayErrorMessage(err));
          setSessions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }
    void syncPrepaidExpiry(sessionShown(sessions, routeSessionId));
    void syncGradskiClockEnd(sessionShown(sessions, routeSessionId));
    void syncStillParked(sessionShown(sessions, routeSessionId));
  }, [loading, sessions, routeSessionId]);

  const handleSmsResult = useCallback(
    async (
      result: SessionResult,
      afterSent: () => void | Promise<void>,
    ) => {
      setSmsManual(null);
      const outcome = await openSmsFromResult(result, (recipient, body) => {
        setSmsManual({ recipient, body });
      });
      if (outcome === 'missing') {
        const reason = result.sms?.reason?.trim();
        setError(reason || t('paySmsMissing'));
        return;
      }
      if (outcome === 'unavailable') {
        return;
      }
      if (outcome === 'sent') {
        const sent = await markSent(result.data.id);
        void syncPrepaidExpiry(sent.data);
        void syncGradskiClockEnd(sent.data);
        void syncStillParked(sent.data);
        await afterSent();
        return;
      }
      if (outcome === 'cancelled') {
        return;
      }
    },
    [t],
  );

  const onStopSendS = useCallback(async () => {
    if (!session || actionBusy) {
      return;
    }
    setActionBusy(true);
    setError(null);
    try {
      const result = await stopSession(session.id);
      await handleSmsResult(result, () => router.back());
    } catch (err) {
      setError(displayErrorMessage(err));
    } finally {
      setActionBusy(false);
    }
  }, [session, actionBusy, handleSmsResult, router]);

  const onAlreadySentS = useCallback(async () => {
    if (!session || actionBusy) {
      return;
    }
    setActionBusy(true);
    setError(null);
    try {
      await stopSession(session.id, { already_sent: true });
      router.back();
    } catch (err) {
      setError(displayErrorMessage(err));
    } finally {
      setActionBusy(false);
    }
  }, [session, actionBusy, router]);

  const onExtend = useCallback(async () => {
    if (!session || actionBusy) {
      return;
    }
    const hours = session.purchased_hours;
    if (hours === null || hours < 1 || hours > 24) {
      return;
    }
    setActionBusy(true);
    setError(null);
    try {
      const result = await extendSession(session.id, hours);
      await handleSmsResult(result, () => router.back());
    } catch (err) {
      setError(displayErrorMessage(err));
    } finally {
      setActionBusy(false);
    }
  }, [session, actionBusy, handleSmsResult, router]);

  const navy = lightColors.primary;
  const prepaid = session ? isPrepaid(session) : false;
  const zoneCode = session?.zone?.code ?? null;
  const zoneName = session?.zone?.name?.trim() ?? '';
  const zoneTitle =
    zoneName ||
    (zoneCode
      ? t('payZoneCode').replace('{code}', zoneCode)
      : t('payPickZone'));
  const operatorName = operatorLineLabel(session?.zone?.operator);
  const modelLabel = prepaid ? t('payPrepaidLabel') : t('sessionPerSession');
  const subtitleParts = [operatorName, modelLabel].filter(Boolean);
  const subtitle = subtitleParts.join(' · ');

  const freeAfterEnd = useMemo(() => {
    if (!zoneCode) {
      return null;
    }
    const feature = findFeatureByCode(features, zoneCode);
    if (!feature) {
      return null;
    }
    const endsAt = paidEndsAt(feature);
    return endsAt ? formatClockFromIso(endsAt) : null;
  }, [features, zoneCode]);

  const startTimeLabel =
    session?.started_at ? formatClockFromIso(session.started_at) : null;
  const untilTimeLabel = session?.paid_until_local
    ? formatClockFromIso(session.paid_until_local)
    : null;

  const metaLine = useMemo(() => {
    if (!session) {
      return null;
    }
    const parts: string[] = [];
    if (prepaid) {
      if (untilTimeLabel) {
        parts.push(t('sessionUntil').replace('{time}', untilTimeLabel));
      }
    } else if (startTimeLabel) {
      parts.push(t('sessionSince').replace('{time}', startTimeLabel));
    }
    if (plate) {
      parts.push(plate);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [session, prepaid, untilTimeLabel, startTimeLabel, plate, t]);

  const confirmed = session?.confirmation_status === 'confirmed';

  const confirmationSubtitle = useMemo(() => {
    if (!session || !confirmed) {
      return null;
    }
    const parts: string[] = [];
    if (zoneCode) {
      parts.push(zoneCode);
    }
    if (plate) {
      parts.push(plate);
    }
    if (startTimeLabel) {
      parts.push(startTimeLabel);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [session, confirmed, zoneCode, plate, startTimeLabel]);

  const bigClock = useMemo(() => {
    if (!session) {
      return null;
    }
    if (prepaid) {
      return formatCountdown(session.paid_until_local, nowMs);
    }
    if (!session.started_at) {
      return null;
    }
    return formatElapsed(session.started_at, nowMs);
  }, [session, prepaid, nowMs]);

  const canExtend =
    session !== null &&
    prepaid &&
    session.purchased_hours !== null &&
    session.purchased_hours >= 1 &&
    session.purchased_hours <= 24;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, paddingHorizontal: 16 },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={[
            styles.backButton,
            { backgroundColor: colors.card },
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={colors.primary}
          />
          <AppText
            style={[
              styles.backLabel,
              {
                color: colors.primary,
                fontFamily: interLoaded ? 'Inter_600SemiBold' : undefined,
              },
            ]}
          >
            {t('back')}
          </AppText>
        </Pressable>
        {session ? (
          <View
            style={[
              styles.paidPill,
              { backgroundColor: colors.paidSoft },
            ]}
          >
            <View
              style={[styles.paidDot, { backgroundColor: colors.paid }]}
            />
            <AppText
              style={[
                styles.paidPillText,
                {
                  color: colors.paidText,
                  fontFamily: interLoaded ? 'Inter_600SemiBold' : undefined,
                },
              ]}
            >
              {t('sessionPaid')}
            </AppText>
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !session ? (
        <View style={styles.emptyWrap}>
          <AppText variant="label" style={{ textAlign: 'center' }}>
            {t('sessionNoActive')}
          </AppText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.navyCard, { backgroundColor: navy }]}>
            <View style={styles.navyTop}>
              <View style={styles.zoneBadge}>
                <AppText
                  style={[
                    styles.zoneBadgeText,
                    {
                      color: navy,
                      fontFamily: interLoaded ? 'Inter_700Bold' : undefined,
                      fontWeight: '800',
                    },
                  ]}
                >
                  {zoneCode ?? '—'}
                </AppText>
              </View>
              <View style={styles.navyTitles}>
                <AppText
                  style={[
                    styles.zoneTitle,
                    {
                      color: '#FFFFFF',
                      fontFamily: interLoaded ? 'Inter_700Bold' : undefined,
                    },
                  ]}
                >
                  {zoneTitle}
                </AppText>
                {subtitle ? (
                  <AppText style={styles.navySubtitle}>{subtitle}</AppText>
                ) : null}
              </View>
            </View>

            {bigClock !== null ? (
              <View style={styles.clockBlock}>
                <AppText style={styles.clockLabel}>
                  {prepaid ? t('sessionTimeLeft') : t('sessionParkingTime')}
                </AppText>
                <AppText
                  style={[
                    styles.bigClock,
                    {
                      fontFamily: interLoaded ? 'Inter_700Bold' : undefined,
                    },
                  ]}
                >
                  {bigClock}
                </AppText>
                {metaLine ? (
                  <AppText style={styles.metaLine}>{metaLine}</AppText>
                ) : null}
              </View>
            ) : null}

            {freeAfterEnd ? (
              <View style={styles.freeAfterRow}>
                <AppText style={styles.freeAfterLabel}>
                  {t('sessionFreeAfter')}
                </AppText>
                <AppText
                  style={[
                    styles.freeAfterValue,
                    {
                      fontFamily: interLoaded ? 'Inter_700Bold' : undefined,
                    },
                  ]}
                >
                  {t('sessionFreeAfterToday').replace('{time}', freeAfterEnd)}
                </AppText>
              </View>
            ) : null}
          </View>

          <View
            style={[
              styles.operatorCard,
              {
                backgroundColor: confirmed ? colors.card : colors.divider,
              },
            ]}
          >
            {confirmed ? (
              <View
                style={[
                  styles.checkCircle,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={colors.primary}
                />
              </View>
            ) : null}
            <View style={styles.operatorText}>
              <AppText
                variant="label"
                style={{
                  color: confirmed ? colors.text : colors.muted,
                  fontFamily: interLoaded ? 'Inter_600SemiBold' : undefined,
                }}
              >
                {confirmed
                  ? t('sessionOperatorConfirmed')
                  : t('sessionOperatorPending')}
              </AppText>
              {confirmationSubtitle ? (
                <AppText variant="muted">{confirmationSubtitle}</AppText>
              ) : null}
            </View>
          </View>

          {error ? (
            <AppText variant="label" style={{ color: colors.payText }}>
              {error}
            </AppText>
          ) : null}

          {smsManual ? (
            <View
              style={[
                styles.smsManualBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <AppText variant="muted">{t('paySmsCopyHint')}</AppText>
              <AppText variant="label">
                {t('paySmsTo').replace('{recipient}', smsManual.recipient)}
              </AppText>
              <AppText>{smsManual.body}</AppText>
            </View>
          ) : null}

          <View style={styles.bottomActions}>
            <AppText
              variant="muted"
              style={styles.hint}
            >
              {prepaid ? t('sessionExtendHint') : t('sessionStopHint')}
            </AppText>

            {prepaid ? (
              <Pressable
                accessibilityRole="button"
                disabled={!canExtend || actionBusy}
                onPress={() => void onExtend()}
                style={[
                  styles.payAction,
                  {
                    backgroundColor: colors.pay,
                    opacity: !canExtend || actionBusy ? 0.5 : 1,
                  },
                ]}
              >
                <AppText
                  style={[
                    styles.payActionLabel,
                    {
                      color: lightColors.primary,
                      fontFamily: interLoaded ? 'Inter_700Bold' : undefined,
                    },
                  ]}
                >
                  {t('sessionExtend')}
                </AppText>
              </Pressable>
            ) : (
              <>
                <Pressable
                  accessibilityRole="button"
                  disabled={actionBusy}
                  onPress={() => void onStopSendS()}
                  style={[
                    styles.payAction,
                    {
                      backgroundColor: colors.pay,
                      opacity: actionBusy ? 0.5 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.stopIcon,
                      { backgroundColor: lightColors.primary },
                    ]}
                  />
                  <AppText
                    style={[
                      styles.payActionLabel,
                      {
                        color: lightColors.primary,
                        fontFamily: interLoaded ? 'Inter_700Bold' : undefined,
                      },
                    ]}
                  >
                    {t('sessionStopSendS')}
                  </AppText>
                </Pressable>
                <Button
                  title={t('sessionAlreadySentS')}
                  variant="text"
                  onPress={() => void onAlreadySentS()}
                  disabled={actionBusy}
                />
              </>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingRight: 14,
    paddingLeft: 4,
    borderRadius: 22,
    gap: 2,
  },
  backLabel: {
    fontSize: 16,
    lineHeight: 20,
  },
  paidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  paidDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  paidPillText: {
    fontSize: 14,
    lineHeight: 18,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  navyCard: {
    borderRadius: 26,
    padding: 20,
    gap: 20,
  },
  navyTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  zoneBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneBadgeText: {
    fontSize: 18,
    lineHeight: 22,
  },
  navyTitles: {
    flex: 1,
    gap: 4,
  },
  zoneTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  navySubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 20,
  },
  clockBlock: {
    gap: 6,
  },
  clockLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 20,
  },
  bigClock: {
    color: '#FFFFFF',
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '700',
  },
  metaLine: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    lineHeight: 22,
  },
  freeAfterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
    paddingTop: 16,
  },
  freeAfterLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 20,
  },
  freeAfterValue: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
  },
  operatorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 16,
    padding: 16,
  },
  checkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorText: {
    flex: 1,
    gap: 4,
  },
  smsManualBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  bottomActions: {
    gap: 12,
    marginTop: 8,
  },
  hint: {
    textAlign: 'center',
  },
  payAction: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  payActionLabel: {
    fontSize: 17,
    lineHeight: 22,
  },
  stopIcon: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
