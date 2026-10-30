import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  listSessions,
  type ParkingSession,
  type ParkingSessionZoneOperator,
  type SessionListMeta,
} from '../../../src/api/sessions';
import { listVehicles, type Vehicle } from '../../../src/api/vehicles';
import { AppText } from '../../../src/components/AppText';
import { Card } from '../../../src/components/Card';
import { type Locale, type TranslationKey } from '../../../src/i18n/catalogs';
import { useLocale } from '../../../src/i18n/LocaleProvider';
import { useInterLoaded } from '../../../src/theme/FontContext';
import { useTheme } from '../../../src/theme/ThemeProvider';

type MonthGroup = {
  key: string;
  heading: string | null;
  sessions: ParkingSession[];
};

function localeTag(locale: Locale): string {
  return locale === 'mk' ? 'mk-MK' : 'en-GB';
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

function parsesAsTime(value: string | null): boolean {
  if (!value) {
    return false;
  }
  if (!Number.isNaN(Date.parse(value))) {
    return true;
  }
  return /(\d{1,2}):(\d{2})/.test(value);
}

function formatMonthHeading(date: Date, locale: Locale): string {
  const tag = localeTag(locale);
  return new Intl.DateTimeFormat(tag, {
    month: 'long',
    year: 'numeric',
  })
    .format(date)
    .toLocaleUpperCase(tag);
}

function formatDayShortMonth(date: Date, locale: Locale): string {
  const tag = localeTag(locale);
  return new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function groupSessionsByMonth(
  sessions: ParkingSession[],
  locale: Locale,
): MonthGroup[] {
  const byKey = new Map<string, ParkingSession[]>();
  const keyOrder: string[] = [];
  const withoutDate: ParkingSession[] = [];

  for (const session of sessions) {
    if (!session.started_at) {
      withoutDate.push(session);
      continue;
    }
    const parsed = Date.parse(session.started_at);
    if (Number.isNaN(parsed)) {
      withoutDate.push(session);
      continue;
    }
    const date = new Date(parsed);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!byKey.has(key)) {
      byKey.set(key, []);
      keyOrder.push(key);
    }
    byKey.get(key)!.push(session);
  }

  keyOrder.sort((a, b) => b.localeCompare(a));

  const groups: MonthGroup[] = keyOrder.map((key) => {
    const groupSessions = byKey.get(key)!;
    const sample = groupSessions[0]!;
    const heading = formatMonthHeading(
      new Date(Date.parse(sample.started_at!)),
      locale,
    );
    return { key, heading, sessions: groupSessions };
  });

  if (withoutDate.length > 0) {
    groups.push({
      key: 'no-date',
      heading: null,
      sessions: withoutDate,
    });
  }

  return groups;
}

function operatorShortName(
  operator: ParkingSessionZoneOperator,
): string | null {
  if (operator && typeof operator === 'object' && 'short_name' in operator) {
    return operator.short_name;
  }
  return null;
}

function zoneTitle(
  session: ParkingSession,
  t: (key: TranslationKey) => string,
): string {
  const zone = session.zone;
  if (!zone) {
    return t('payZoneCode').replace('{code}', '—');
  }
  const base =
    zone.name?.trim() ||
    t('payZoneCode').replace('{code}', zone.code ?? '—');
  const short = operatorShortName(zone.operator);
  return short ? `${base} · ${short}` : base;
}

function HistoryRow({
  session,
  plate,
}: {
  session: ParkingSession;
  plate: string | null;
}) {
  const { t, locale } = useLocale();
  const { colors } = useTheme();
  const interLoaded = useInterLoaded();

  const cancelled = session.status === 'cancelled';
  const prepaid = session.payment_model === 'prepaid';
  const zoneCode = session.zone?.code ?? '—';

  let subtitle = '';
  if (session.started_at) {
    const parsed = Date.parse(session.started_at);
    if (!Number.isNaN(parsed)) {
      const date = new Date(parsed);
      const dayPart = formatDayShortMonth(date, locale);
      const startClock = formatClockFromIso(session.started_at);
      if (
        prepaid &&
        session.paid_until_local &&
        parsesAsTime(session.paid_until_local)
      ) {
        const endClock = formatClockFromIso(session.paid_until_local);
        subtitle = `${dayPart} · ${startClock}–${endClock}`;
      } else {
        subtitle = `${dayPart} · ${startClock}`;
      }
    }
  }
  if (plate) {
    subtitle = subtitle ? `${subtitle} · ${plate}` : plate;
  }

  let durationLabel = t('historyNoDuration');
  if (prepaid && session.purchased_hours != null) {
    durationLabel = t('historyPrepaidAdvance').replace(
      '{n}',
      String(session.purchased_hours),
    );
  }

  let statusLabel: string;
  let statusColor: string;
  if (cancelled) {
    statusLabel = t('historyCancelled');
    statusColor = colors.muted;
  } else if (session.confirmation_status === 'confirmed') {
    statusLabel = t('historyConfirmed');
    statusColor = colors.paid;
  } else {
    statusLabel = t('historyNotConfirmed');
    statusColor = colors.payText;
  }

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.zoneBadge,
          {
            backgroundColor: cancelled ? colors.divider : colors.primarySoft,
          },
        ]}
      >
        <AppText
          style={[
            styles.zoneCodeText,
            {
              color: cancelled ? colors.muted : colors.primary,
              fontFamily: interLoaded ? 'Inter_700Bold' : undefined,
              fontWeight: '700',
            },
          ]}
        >
          {zoneCode}
        </AppText>
      </View>
      <View style={styles.rowBody}>
        <AppText
          numberOfLines={2}
          style={[
            styles.rowTitle,
            {
              color: colors.text,
              fontFamily: interLoaded ? 'Inter_600SemiBold' : undefined,
              fontWeight: '600',
            },
          ]}
        >
          {zoneTitle(session, t)}
        </AppText>
        {subtitle ? (
          <AppText variant="muted" numberOfLines={2} style={styles.rowSubtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={styles.rowMeta}>
        <AppText
          style={[
            styles.durationText,
            {
              color: colors.text,
              fontFamily: interLoaded ? 'Inter_600SemiBold' : undefined,
              fontWeight: '600',
            },
          ]}
        >
          {durationLabel}
        </AppText>
        <AppText style={[styles.statusText, { color: statusColor }]}>
          {statusLabel}
        </AppText>
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const { t, locale } = useLocale();
  const { colors } = useTheme();
  const interLoaded = useInterLoaded();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    null,
  );
  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [meta, setMeta] = useState<SessionListMeta | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadInFlightRef = useRef(false);
  const initialSessionsDoneRef = useRef(false);
  const selectedVehicleIdRef = useRef<number | null>(null);

  useEffect(() => {
    selectedVehicleIdRef.current = selectedVehicleId;
  }, [selectedVehicleId]);

  const plateByVehicleId = useMemo(() => {
    const map = new Map<number, string>();
    for (const v of vehicles) {
      map.set(v.id, v.formatted_plate);
    }
    return map;
  }, [vehicles]);

  const monthGroups = useMemo(
    () => groupSessionsByMonth(sessions, locale),
    [sessions, locale],
  );

  const loadVehicles = useCallback(async (isActive: () => boolean) => {
    try {
      const data = await listVehicles();
      if (!isActive()) {
        return;
      }
      setVehicles(data);
    } catch {
      if (!isActive()) {
        return;
      }
    }
  }, []);

  const fetchSessions = useCallback(
    async (
      page: number,
      options: {
        vehicleId: number | null;
        append: boolean;
        isActive: () => boolean;
        onDoneRefreshing?: () => void;
      },
    ) => {
      if (loadInFlightRef.current && !options.append) {
        return;
      }
      if (options.append) {
        setLoadingMore(true);
      } else if (!initialSessionsDoneRef.current) {
        setInitialLoading(true);
      }
      loadInFlightRef.current = true;
      try {
        const query =
          options.vehicleId != null
            ? { vehicle_id: options.vehicleId, page }
            : { page };
        const result = await listSessions(query);
        if (!options.isActive()) {
          return;
        }
        setMeta(result.meta);
        if (options.append) {
          setSessions((prev) => {
            const seen = new Set(prev.map((s) => s.id));
            const merged = [...prev];
            for (const row of result.data) {
              if (!seen.has(row.id)) {
                merged.push(row);
              }
            }
            return merged;
          });
        } else {
          setSessions(result.data);
        }
      } catch {
        if (!options.isActive()) {
          return;
        }
      } finally {
        loadInFlightRef.current = false;
        if (options.isActive()) {
          setLoadingMore(false);
          setInitialLoading(false);
          initialSessionsDoneRef.current = true;
          options.onDoneRefreshing?.();
        }
      }
    },
    [],
  );

  const reloadSessions = useCallback(
    (vehicleId: number | null, isActive: () => boolean) => {
      void fetchSessions(1, {
        vehicleId,
        append: false,
        isActive,
      });
    },
    [fetchSessions],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadVehicles(() => active);
      reloadSessions(selectedVehicleIdRef.current, () => active);
      return () => {
        active = false;
      };
    }, [loadVehicles, reloadSessions]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchSessions(1, {
      vehicleId: selectedVehicleId,
      append: false,
      isActive: () => true,
      onDoneRefreshing: () => setRefreshing(false),
    });
  }, [fetchSessions, selectedVehicleId]);

  const onEndReached = useCallback(() => {
    if (loadingMore || loadInFlightRef.current) {
      return;
    }
    if (!meta || meta.current_page >= meta.last_page) {
      return;
    }
    void fetchSessions(meta.current_page + 1, {
      vehicleId: selectedVehicleId,
      append: true,
      isActive: () => true,
    });
  }, [fetchSessions, loadingMore, meta, selectedVehicleId]);

  function onSelectVehicle(id: number | null) {
    if (id === selectedVehicleId) {
      return;
    }
    setSelectedVehicleId(id);
    void fetchSessions(1, {
      vehicleId: id,
      append: false,
      isActive: () => true,
    });
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      <AppText
        style={[
          styles.screenTitle,
          {
            color: colors.text,
            fontFamily: interLoaded ? 'Inter_700Bold' : undefined,
            fontWeight: '800',
          },
        ]}
      >
        {t('history')}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => onSelectVehicle(null)}
          style={[
            styles.chip,
            selectedVehicleId === null
              ? { backgroundColor: colors.primary, borderColor: colors.primary }
              : {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
          ]}
        >
          <AppText
            style={[
              styles.chipLabel,
              {
                color:
                  selectedVehicleId === null
                    ? colors.textOnPrimary
                    : colors.text,
                fontFamily: interLoaded ? 'Inter_600SemiBold' : undefined,
                fontWeight: '600',
              },
            ]}
          >
            {t('historyAll')}
          </AppText>
        </Pressable>
        {vehicles.map((vehicle) => {
          const selected = selectedVehicleId === vehicle.id;
          return (
            <Pressable
              key={vehicle.id}
              accessibilityRole="button"
              onPress={() => onSelectVehicle(vehicle.id)}
              style={[
                styles.chip,
                selected
                  ? {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    }
                  : {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
              ]}
            >
              <AppText
                style={[
                  styles.chipLabel,
                  {
                    color: selected ? colors.textOnPrimary : colors.text,
                    fontFamily: interLoaded ? 'Inter_600SemiBold' : undefined,
                    fontWeight: '600',
                  },
                ]}
              >
                {vehicle.formatted_plate}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
      {!initialLoading && sessions.length === 0 ? (
        <AppText variant="muted" style={styles.emptyText}>
          {t('historyEmpty')}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <FlatList
        data={monthGroups}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore
            ? (
                <ActivityIndicator
                  style={styles.footerSpinner}
                  color={colors.primary}
                />
              )
            : undefined
        }
        renderItem={({ item: group }) => (
          <View style={styles.monthBlock}>
            {group.heading ? (
              <AppText variant="muted" style={styles.monthHeading}>
                {group.heading}
              </AppText>
            ) : null}
            <Card style={styles.monthCard}>
              {group.sessions.map((session, index) => (
                <View key={session.id}>
                  {index > 0 ? (
                    <View
                      style={[
                        styles.rowDivider,
                        { backgroundColor: colors.divider },
                      ]}
                    />
                  ) : null}
                  <HistoryRow
                    session={session}
                    plate={plateByVehicleId.get(session.vehicle_id) ?? null}
                  />
                </View>
              ))}
            </Card>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexGrow: 1,
  },
  headerBlock: {
    paddingTop: 8,
    marginBottom: 8,
  },
  screenTitle: {
    fontSize: 32,
    lineHeight: 38,
    marginBottom: 16,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  emptyText: {
    marginTop: 8,
    marginBottom: 8,
  },
  monthBlock: {
    marginTop: 16,
  },
  monthHeading: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  monthCard: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
  },
  zoneBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneCodeText: {
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  rowSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  rowMeta: {
    alignItems: 'flex-end',
    paddingTop: 2,
    maxWidth: 120,
  },
  durationText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
  },
  statusText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'right',
  },
  footerSpinner: {
    marginVertical: 16,
  },
});
