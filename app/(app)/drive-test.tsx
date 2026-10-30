import * as Location from 'expo-location';
import { File, Paths } from 'expo-file-system';
import { useKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';
import { Pedometer } from 'expo-sensors';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import {
  initialDetection,
  stepDetection,
  type DetectionSnapshot,
  type DetectionState,
} from '../../src/detection/machine';
import { isIgnoredFix } from '../../src/detection/ignoreSpots';
import { readIgnoredSpots } from '../../src/detection/ignoreList';
import { readReminderDelays } from '../../src/detection/reminderDelaysStorage';
import { readRemindersEnabled } from '../../src/detection/remindersEnabledStorage';
import {
  REMINDER_CATEGORY_ID,
  subscribeReminderLog,
} from '../../src/detection/reminderActions';
import {
  planStopReminders,
  reminderDeliveries,
} from '../../src/detection/reminders';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { paidNow, zoneAt, type Holiday, type ZoneFeature } from '../../src/detection/zone';
import {
  formatSampleLogLine,
  formatStateChangeLine,
} from '../../src/drive-test/logFormat';
import {
  fetchOpenSession,
  loadHolidays,
  loadZones,
} from '../../src/drive-test/zoneData';
import { AppText } from '../../src/components/AppText';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';

const ON_SCREEN_LOG_LIMIT = 200;
const MIN_CADENCE_GAP_MS = 3_000;
const SESSION_POLL_MS = 60_000;

const REMINDER_CANCEL_STATES: DetectionState[] = [
  'DRIVING',
  'PAID',
  'LEFT',
  'DISMISSED',
];

type PermissionFlags = {
  location: boolean | null;
  motion: boolean | null;
  notifications: boolean | null;
};

function speedMsToKmh(speedMs: number | null | undefined): number | null {
  if (speedMs === null || speedMs === undefined || speedMs < 0) {
    return null;
  }
  return speedMs * 3.6;
}

function paidForZone(
  features: ZoneFeature[],
  holidays: Holiday[],
  zoneCode: string | null,
  atMs: number,
): boolean {
  if (!zoneCode) {
    return false;
  }
  const feature = features.find((f) => f.properties.code === zoneCode);
  if (!feature) {
    return false;
  }
  return paidNow(feature, atMs, holidays);
}

export default function DriveTestScreen() {
  useKeepAwake();
  const { locale } = useLocale();

  const [permissionFlags, setPermissionFlags] = useState<PermissionFlags>({
    location: null,
    motion: null,
    notifications: null,
  });
  const [snapshot, setSnapshot] = useState<DetectionSnapshot>(initialDetection());
  const [logLines, setLogLines] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  const snapshotRef = useRef(snapshot);
  const logRef = useRef<string[]>([]);
  const zonesRef = useRef<ZoneFeature[]>([]);
  const holidaysRef = useRef<Holiday[]>([]);
  const openSessionRef = useRef(false);
  const stepCountRef = useRef<number | null>(null);
  const cadenceRef = useRef<number | null>(null);
  const prevStepRef = useRef<{ at: number; steps: number } | null>(null);
  const lastFixRef = useRef<{
    at: number;
    latitude: number;
    longitude: number;
    speedKmh: number | null;
    accuracyM: number | null;
  } | null>(null);
  const reminderIdentifiersRef = useRef<string[]>([]);
  const reminderZoneRef = useRef<string | null>(null);

  const appendLog = useCallback((line: string) => {
    logRef.current = [...logRef.current, line];
    setLogLines(logRef.current.slice(-ON_SCREEN_LOG_LIMIT));
  }, []);

  useEffect(() => {
    return subscribeReminderLog(appendLog);
  }, [appendLog]);

  const clearScheduledReminders = useCallback(async (logZoneCode: string | null) => {
    const ids = reminderIdentifiersRef.current;
    if (ids.length === 0) {
      return;
    }
    for (const id of ids) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
    reminderIdentifiersRef.current = [];
    reminderZoneRef.current = null;
    if (logZoneCode) {
      appendLog(`reminder cancel ${logZoneCode}`);
    }
  }, [appendLog]);

  const scheduleStopReminders = useCallback(
    async (zoneCode: string, snap: DetectionSnapshot) => {
      if (!readRemindersEnabled()) {
        return;
      }

      const stoppedSince = snap.stoppedSince;
      if (stoppedSince === null) {
        appendLog(`reminder skip ${zoneCode}`);
        return;
      }

      const stopId = `${zoneCode}:${stoppedSince}`;
      const plan = planStopReminders({
        stopId,
        zoneCode,
        operatorName: '',
        locale: locale === 'en' ? 'en' : 'mk',
        nowMs: Date.now(),
        anchorMs: null,
        scheduledCount: 0,
        secondDelayMinutes: readReminderDelays().secondReminderMinutes,
        eligible: true,
      });

      if (reminderIdentifiersRef.current.length > 0) {
        await clearScheduledReminders(null);
      }

      const deliveries = reminderDeliveries(plan);
      const stored: string[] = [];
      const fix = lastFixRef.current;

      for (const delivery of deliveries) {
        let notificationData = delivery.data;
        if (
          fix &&
          Number.isFinite(fix.latitude) &&
          Number.isFinite(fix.longitude)
        ) {
          notificationData = {
            ...delivery.data,
            latitude: fix.latitude,
            longitude: fix.longitude,
          };
          if (fix.accuracyM !== null && Number.isFinite(fix.accuracyM)) {
            notificationData = { ...notificationData, accuracyM: fix.accuracyM };
          }
        }

        if (delivery.kind === 'first') {
          await Notifications.scheduleNotificationAsync({
            identifier: delivery.identifier,
            content: {
              title: delivery.title,
              body: delivery.body,
              data: notificationData,
              categoryIdentifier: REMINDER_CATEGORY_ID,
            },
            trigger: null,
          });
          stored.push(delivery.identifier);
          appendLog(`reminder schedule first ${zoneCode}`);
          continue;
        }

        try {
          await Notifications.scheduleNotificationAsync({
            identifier: delivery.identifier,
            content: {
              title: delivery.title,
              body: delivery.body,
              data: notificationData,
              categoryIdentifier: REMINDER_CATEGORY_ID,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: new Date(delivery.fireAtMs),
            },
          });
          stored.push(delivery.identifier);
          appendLog(`reminder schedule second ${zoneCode}`);
        } catch {
          appendLog('reminder second unsupported');
        }
      }

      reminderIdentifiersRef.current = stored;
      reminderZoneRef.current = zoneCode;
    },
    [appendLog, clearScheduledReminders, locale],
  );

  const runDetection = useCallback(
    (at: number, stepCount: number | null) => {
      const fix = lastFixRef.current;
      const features = zonesRef.current;
      const holidays = holidaysRef.current;

      let zoneCode: string | null = null;
      let ambiguous = false;
      let speedKmh: number | null = null;
      let accuracyM: number | null = null;

      if (fix) {
        speedKmh = fix.speedKmh;
        accuracyM = fix.accuracyM;
        const zone = zoneAt(
          features,
          fix.latitude,
          fix.longitude,
          fix.accuracyM,
        );
        zoneCode = zone.zoneCode;
        ambiguous = zone.ambiguous;
      }

      const paid = paidForZone(features, holidays, zoneCode, at);
      const openSession = openSessionRef.current;

      let ignored = false;
      try {
        const spots = readIgnoredSpots();
        if (fix) {
          ignored = isIgnoredFix(spots, {
            latitude: fix.latitude,
            longitude: fix.longitude,
          });
        }
      } catch {
        ignored = false;
      }

      const prevSnapshot = snapshotRef.current;
      const prevState = prevSnapshot.state;
      const result = stepDetection(snapshotRef.current, {
        at,
        speedKmh,
        accuracyM,
        stepCount,
        activity: null,
        activityConfidence: null,
        zoneCode,
        ambiguous,
        paidNow: paid,
        openSession,
        ignored,
        remindedRecently: false,
      });

      snapshotRef.current = result.snapshot;
      setSnapshot(result.snapshot);

      appendLog(
        formatSampleLogLine({
          at,
          state: result.snapshot.state,
          speedKmh,
          accuracyM,
          stepCount,
          cadence: cadenceRef.current,
          zoneCode,
          paidNow: paid,
          ambiguous,
          openSession,
          event: result.event,
        }),
      );

      if (prevState !== result.snapshot.state) {
        appendLog(formatStateChangeLine(at, prevState, result.snapshot.state));
        if (REMINDER_CANCEL_STATES.includes(result.snapshot.state)) {
          const zoneForLog =
            reminderZoneRef.current ?? prevSnapshot.zoneCode ?? '?';
          void clearScheduledReminders(zoneForLog);
        }
      }

      if (result.event.type === 'remind') {
        void scheduleStopReminders(result.event.zoneCode, result.snapshot);
      }
    },
    [appendLog, clearScheduledReminders, scheduleStopReminders],
  );

  const updateCadence = useCallback(
    (at: number, steps: number): number | null => {
      const prev = prevStepRef.current;
      prevStepRef.current = { at, steps };
      if (!prev) {
        return null;
      }
      const deltaMs = at - prev.at;
      if (deltaMs < MIN_CADENCE_GAP_MS) {
        return cadenceRef.current;
      }
      const deltaSteps = steps - prev.steps;
      if (deltaSteps < 0) {
        return cadenceRef.current;
      }
      const cadence = (deltaSteps / deltaMs) * 60_000;
      cadenceRef.current = cadence;
      return cadence;
    },
    [],
  );

  useEffect(() => {
    let locationSub: Location.LocationSubscription | null = null;
    let pedometerSub: { remove: () => void } | null = null;
    let sessionTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const refreshOpenSession = async () => {
      openSessionRef.current = await fetchOpenSession();
    };

    const start = async () => {
      const [locPerm, motionPerm, notifPerm] = await Promise.all([
        Location.requestForegroundPermissionsAsync(),
        Pedometer.requestPermissionsAsync(),
        Notifications.requestPermissionsAsync(),
      ]);

      if (cancelled) {
        return;
      }

      setPermissionFlags({
        location: locPerm.granted,
        motion: motionPerm.granted,
        notifications: notifPerm.granted,
      });

      zonesRef.current = await loadZones();
      holidaysRef.current = await loadHolidays();
      await refreshOpenSession();

      sessionTimer = setInterval(() => {
        void refreshOpenSession();
      }, SESSION_POLL_MS);

      if (locPerm.granted) {
        locationSub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          (fix) => {
            const at = fix.timestamp;
            const speedKmh = speedMsToKmh(fix.coords.speed);
            const accuracyM = fix.coords.accuracy ?? null;
            lastFixRef.current = {
              at,
              latitude: fix.coords.latitude,
              longitude: fix.coords.longitude,
              speedKmh,
              accuracyM,
            };
            runDetection(at, stepCountRef.current);
          },
        );
      }

      if (motionPerm.granted) {
        const available = await Pedometer.isAvailableAsync();
        if (available) {
          pedometerSub = Pedometer.watchStepCount((result) => {
            const at = Date.now();
            stepCountRef.current = result.steps;
            updateCadence(at, result.steps);
            runDetection(at, result.steps);
          });
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      locationSub?.remove();
      pedometerSub?.remove();
      if (sessionTimer) {
        clearInterval(sessionTimer);
      }
    };
  }, [runDetection, updateCadence]);

  const onExport = async () => {
    setExporting(true);
    try {
      const file = new File(Paths.cache, 'drive-test-log.txt');
      if (file.exists) {
        file.delete();
      }
      file.create();
      await file.write(logRef.current.join('\n'));
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/plain',
          dialogTitle: 'Drive test log',
        });
      }
    } finally {
      setExporting(false);
    }
  };

  const permissionNote = (granted: boolean | null, label: string) => {
    if (granted === null) {
      return null;
    }
    if (granted) {
      return null;
    }
    return (
      <AppText variant="muted" style={styles.permissionWarn}>
        {label} permission refused — continuing without it.
      </AppText>
    );
  };

  return (
    <Screen title="Drive test" scroll={false} includeTopInset={false}>
      {permissionNote(permissionFlags.location, 'Location')}
      {permissionNote(permissionFlags.motion, 'Motion')}
      {permissionNote(permissionFlags.notifications, 'Notifications')}

      <View style={styles.statusRow}>
        <AppText variant="label">State: {snapshot.state}</AppText>
        {snapshot.zoneCode ? (
          <AppText variant="muted">Zone: {snapshot.zoneCode}</AppText>
        ) : null}
      </View>

      <Button
        title="Export log"
        variant="secondary"
        disabled={exporting || logLines.length === 0}
        onPress={() => void onExport()}
      />

      <FlatList
        style={styles.logList}
        data={[...logLines].reverse()}
        keyExtractor={(_, index) => String(logLines.length - index)}
        renderItem={({ item }) => (
          <AppText variant="muted" style={styles.logLine}>
            {item}
          </AppText>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  permissionWarn: {
    marginBottom: 8,
  },
  statusRow: {
    marginVertical: 12,
    gap: 4,
  },
  logList: {
    flex: 1,
    marginTop: 16,
  },
  logLine: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});
