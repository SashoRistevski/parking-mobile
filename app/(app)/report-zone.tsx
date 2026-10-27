import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { displayErrorMessage } from '../../src/api/errors';
import { createZoneReport } from '../../src/api/zoneReports';
import { AppText } from '../../src/components/AppText';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { zoneAt, type ZoneFeature } from '../../src/detection/zone';
import { useLocale } from '../../src/i18n/LocaleProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { loadZoneCache } from '../../src/zones/cache';

type Coords = {
  lat: number;
  lng: number;
  accuracyM: number | null;
};

type ZoneListOption = {
  code: string;
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

function buildZoneListOptions(features: ZoneFeature[]): ZoneListOption[] {
  const seen = new Set<string>();
  const out: ZoneListOption[] = [];
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
      name: props.name,
      operatorShort: props.operator?.short_name,
    });
  }
  return out;
}

function zoneListLabel(option: ZoneListOption): string {
  const parts = [option.code];
  if (option.name?.trim()) {
    parts.push(option.name.trim());
  }
  if (option.operatorShort?.trim()) {
    parts.push(option.operatorShort.trim());
  }
  return parts.join(' · ');
}

function codeInCache(features: ZoneFeature[], code: string): boolean {
  return findFeatureByCode(features, code) !== undefined;
}

const ZONE_SUGGESTION_LIMIT = 6;

function filterZoneSuggestions(
  options: ZoneListOption[],
  query: string,
): ZoneListOption[] {
  if (query.length === 0) {
    return [];
  }
  const lower = query.toLowerCase();
  const matches = options.filter((option) => {
    if (option.code.toLowerCase().includes(lower)) {
      return true;
    }
    const name = option.name?.trim();
    return name !== undefined && name.length > 0 && name.toLowerCase().includes(lower);
  });
  return matches.slice(0, ZONE_SUGGESTION_LIMIT);
}

export default function ReportZoneScreen() {
  const { t } = useLocale();
  const { colors } = useTheme();

  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);
  const [features, setFeatures] = useState<ZoneFeature[]>([]);
  const [zoneCodeInput, setZoneCodeInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const cache = await loadZoneCache();
        setFeatures(cache.features);
      } catch {
        setFeatures([]);
      }
    })();
  }, []);

  useEffect(() => {
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
  }, [t]);

  const zoneListOptions = useMemo(
    () => buildZoneListOptions(features),
    [features],
  );

  const zoneSuggestions = useMemo(
    () => filterZoneSuggestions(zoneListOptions, zoneCodeInput),
    [zoneListOptions, zoneCodeInput],
  );

  const detected = useMemo(() => {
    if (!coords) {
      return { zoneCode: null as string | null };
    }
    const { zoneCode } = zoneAt(
      features,
      coords.lat,
      coords.lng,
      coords.accuracyM,
    );
    return { zoneCode };
  }, [coords, features]);

  const trimmedCode = zoneCodeInput.trim();
  const trimmedReason = reasonInput.trim();
  const showNotOnMapWarning =
    trimmedCode.length > 0 && !codeInCache(features, trimmedCode);

  const canSend =
    !submitting &&
    !saved &&
    coords !== null &&
    !locationDenied &&
    trimmedCode.length > 0 &&
    trimmedReason.length > 0;

  const onSend = useCallback(async () => {
    if (!coords || !trimmedCode || !trimmedReason) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const accuracy = accuracyForZoneReport(coords.accuracyM);
      const detectedFeature =
        detected.zoneCode !== null
          ? findFeatureByCode(features, detected.zoneCode)
          : undefined;
      const detectedZoneId = detectedFeature?.properties.zone_id;
      const trimmedNote = noteInput.trim();

      await createZoneReport({
        lat: coords.lat,
        lng: coords.lng,
        reported_zone_code: trimmedCode.slice(0, 32),
        reason: trimmedReason.slice(0, 64),
        ...(accuracy !== undefined && { accuracy_m: accuracy }),
        ...(detectedZoneId !== undefined && {
          detected_zone_id: detectedZoneId,
        }),
        ...(trimmedNote.length > 0 && {
          note: trimmedNote.slice(0, 2000),
        }),
      });
      setSaved(true);
    } catch (err) {
      setError(displayErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }, [
    coords,
    detected.zoneCode,
    features,
    noteInput,
    trimmedCode,
    trimmedReason,
  ]);

  if (saved) {
    return (
      <Screen scroll includeTopInset={false}>
        <AppText variant="body">{t('reportSaved')}</AppText>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      includeTopInset={false}
      automaticallyAdjustKeyboardInsets
      scrollBottomPadding={120}
    >
      {locating ? <ActivityIndicator color={colors.primary} /> : null}

      {locationDenied ? (
        <AppText style={{ color: colors.pay }}>{t('payLocationDenied')}</AppText>
      ) : null}

      {coords && !locating ? (
        <View style={styles.block}>
          <AppText variant="label">
            {detected.zoneCode
              ? t('reportDetectedZone').replace('{code}', detected.zoneCode)
              : t('reportNoZoneDetected')}
          </AppText>
        </View>
      ) : null}

      <View style={styles.block}>
        <TextField
          value={zoneCodeInput}
          onChangeText={(text) => setZoneCodeInput(text.slice(0, 32))}
          placeholder={t('payOverrideCodePlaceholder')}
          maxLength={32}
          autoCapitalize="characters"
          editable={!submitting}
        />
        {zoneSuggestions.map((option) => (
          <Pressable
            key={option.code}
            accessibilityRole="button"
            onPress={() => setZoneCodeInput(option.code)}
            style={[
              styles.zoneRow,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <AppText>{zoneListLabel(option)}</AppText>
          </Pressable>
        ))}
      </View>

      {showNotOnMapWarning ? (
        <AppText variant="muted" style={styles.block}>
          {t('reportZoneNotOnMap')}
        </AppText>
      ) : null}

      <View style={styles.block}>
        <TextField
          value={reasonInput}
          onChangeText={(text) => setReasonInput(text.slice(0, 64))}
          placeholder={t('reportReasonPlaceholder')}
          maxLength={64}
          editable={!submitting}
        />
        <TextField
          value={noteInput}
          onChangeText={(text) => setNoteInput(text.slice(0, 2000))}
          placeholder={t('reportNotePlaceholder')}
          maxLength={2000}
          multiline
          editable={!submitting}
          style={styles.noteField}
        />
      </View>

      {error ? (
        <AppText style={{ color: colors.pay }}>{error}</AppText>
      ) : null}

      <Button
        title={submitting ? t('reportSending') : t('reportSend')}
        disabled={!canSend}
        onPress={() => void onSend()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    marginBottom: 16,
    gap: 8,
  },
  zoneRow: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  noteField: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
});
