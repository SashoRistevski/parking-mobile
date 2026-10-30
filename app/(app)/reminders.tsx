import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
} from 'react-native';

import { AppText } from '../../src/components/AppText';
import { Card } from '../../src/components/Card';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import {
  readIgnoredSpots,
  removeIgnoredSpotAtIndex,
} from '../../src/detection/ignoreList';
import {
  readReminderDelays,
  writeReminderDelays,
} from '../../src/detection/reminderDelaysStorage';
import {
  cancelAllScheduledReminders,
  readRemindersEnabled,
  writeRemindersEnabled,
} from '../../src/detection/remindersEnabledStorage';
import { useLocale } from '../../src/i18n/LocaleProvider';
import type { TranslationKey } from '../../src/i18n/catalogs';
import { useTheme } from '../../src/theme/ThemeProvider';

type DelayField = 'second' | 'prepaid' | 'stillParked';

function parseInRange(
  text: string,
  min: number,
  max: number,
): number | null {
  const n = Number(text.trim());
  if (!Number.isInteger(n) || n < min || n > max) {
    return null;
  }
  return n;
}

export default function RemindersScreen() {
  const { t } = useLocale();
  const { colors } = useTheme();
  const [enabled, setEnabled] = useState(true);
  const [spotCount, setSpotCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [secondText, setSecondText] = useState('5');
  const [prepaidText, setPrepaidText] = useState('10');
  const [stillParkedText, setStillParkedText] = useState('3');
  const [committedSecond, setCommittedSecond] = useState(5);
  const [committedPrepaid, setCommittedPrepaid] = useState(10);
  const [committedStillParked, setCommittedStillParked] = useState(3);

  const reload = useCallback(() => {
    setEnabled(readRemindersEnabled());
    setSpotCount(readIgnoredSpots().length);
    const delays = readReminderDelays();
    setCommittedSecond(delays.secondReminderMinutes);
    setCommittedPrepaid(delays.prepaidExpiryLeadMinutes);
    setCommittedStillParked(delays.stillParkedAfterHours);
    setSecondText(String(delays.secondReminderMinutes));
    setPrepaidText(String(delays.prepaidExpiryLeadMinutes));
    setStillParkedText(String(delays.stillParkedAfterHours));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const onToggle = useCallback(
    (next: boolean) => {
      if (busy) {
        return;
      }
      setBusy(true);
      setEnabled(next);
      void (async () => {
        try {
          await writeRemindersEnabled(next);
          if (!next) {
            await cancelAllScheduledReminders();
          }
        } catch {
          reload();
        } finally {
          setBusy(false);
        }
      })();
    },
    [busy, reload],
  );

  const onRemove = useCallback(
    (index: number) => {
      if (removingIndex !== null) {
        return;
      }
      setRemovingIndex(index);
      void (async () => {
        try {
          await removeIgnoredSpotAtIndex(index);
          reload();
        } finally {
          setRemovingIndex(null);
        }
      })();
    },
    [reload, removingIndex],
  );

  const commitDelay = useCallback(
    (field: DelayField) => {
      void (async () => {
        try {
          if (field === 'second') {
            const parsed = parseInRange(secondText, 1, 180);
            if (parsed === null) {
              setSecondText(String(committedSecond));
              return;
            }
            const next = await writeReminderDelays({
              secondReminderMinutes: parsed,
            });
            setCommittedSecond(next.secondReminderMinutes);
            setSecondText(String(next.secondReminderMinutes));
            return;
          }
          if (field === 'prepaid') {
            const parsed = parseInRange(prepaidText, 1, 180);
            if (parsed === null) {
              setPrepaidText(String(committedPrepaid));
              return;
            }
            const next = await writeReminderDelays({
              prepaidExpiryLeadMinutes: parsed,
            });
            setCommittedPrepaid(next.prepaidExpiryLeadMinutes);
            setPrepaidText(String(next.prepaidExpiryLeadMinutes));
            return;
          }
          const parsed = parseInRange(stillParkedText, 1, 24);
          if (parsed === null) {
            setStillParkedText(String(committedStillParked));
            return;
          }
          const next = await writeReminderDelays({
            stillParkedAfterHours: parsed,
          });
          setCommittedStillParked(next.stillParkedAfterHours);
          setStillParkedText(String(next.stillParkedAfterHours));
        } catch {
          reload();
        }
      })();
    },
    [
      committedPrepaid,
      committedSecond,
      committedStillParked,
      prepaidText,
      reload,
      secondText,
      stillParkedText,
    ],
  );

  const delayRow = (
    labelKey: TranslationKey,
    value: string,
    onChangeText: (text: string) => void,
    onBlur: () => void,
  ) => (
    <Card style={styles.delayRow}>
      <AppText variant="label" style={styles.delayLabel}>
        {t(labelKey)}
      </AppText>
      <TextField
        keyboardType="number-pad"
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        style={styles.delayInput}
        accessibilityLabel={t(labelKey)}
      />
    </Card>
  );

  return (
    <Screen scroll>
      <Card style={styles.switchRow}>
        <AppText variant="label">{t('remindersTitle')}</AppText>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          disabled={busy}
          trackColor={{ false: colors.muted, true: colors.accent }}
          thumbColor={colors.background}
        />
      </Card>

      {delayRow(
        'remindersSecondDelay',
        secondText,
        setSecondText,
        () => commitDelay('second'),
      )}
      {delayRow(
        'remindersPrepaidLead',
        prepaidText,
        setPrepaidText,
        () => commitDelay('prepaid'),
      )}
      {delayRow(
        'remindersStillParkedAfter',
        stillParkedText,
        setStillParkedText,
        () => commitDelay('stillParked'),
      )}

      {spotCount === 0 ? (
        <AppText variant="muted">{t('remindersNoIgnoredPlaces')}</AppText>
      ) : (
        Array.from({ length: spotCount }, (_, index) => (
          <Card key={index} style={styles.spotRow}>
            <AppText variant="label">
              {t('remindersPlace').replace('{n}', String(index + 1))}
            </AppText>
            <Pressable
              onPress={() => onRemove(index)}
              disabled={removingIndex !== null}
              accessibilityRole="button"
            >
              {removingIndex === index ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <AppText style={{ color: colors.primary600 }}>
                  {t('remindersRemove')}
                </AppText>
              )}
            </Pressable>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  delayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  delayLabel: {
    flex: 1,
  },
  delayInput: {
    width: 72,
    textAlign: 'center',
    paddingVertical: 8,
  },
  spotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
});
