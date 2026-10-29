import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import MapView, { Marker, Polygon, type LatLng } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { postLocate } from '../../../src/api/locate';
import {
  getActiveSessions,
  type ParkingSession,
} from '../../../src/api/sessions';
import { listVehicles, type Vehicle } from '../../../src/api/vehicles';
import { AppText } from '../../../src/components/AppText';
import { Card } from '../../../src/components/Card';
import {
  paidNow,
  zoneAt,
  type Holiday,
  type ZoneFeature,
} from '../../../src/detection/zone';
import { syncPrepaidExpiry } from '../../../src/detection/prepaidExpiryScheduler';
import { syncGradskiClockEnd } from '../../../src/detection/gradskiClockEndScheduler';
import { syncStillParked } from '../../../src/detection/stillParkedScheduler';
import { useLocale } from '../../../src/i18n/LocaleProvider';
import { useInterLoaded } from '../../../src/theme/FontContext';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { loadZoneCache, paidEndsAt } from '../../../src/zones/cache';

const SKOPJE = { latitude: 41.998, longitude: 21.425 };
const LOCATE_CACHE_MAX_MS = 24 * 60 * 60 * 1000;
const MAP_DELTA = 0.06;
const TAB_BAR_HEIGHT = 64;

function ringCentroid(coordinates: LatLng[]): LatLng {
  let lat = 0;
  let lng = 0;
  for (const point of coordinates) {
    lat += point.latitude;
    lng += point.longitude;
  }
  const count = coordinates.length || 1;
  return { latitude: lat / count, longitude: lng / count };
}

function polygonFillColor(
  isCurrent: boolean,
  primary: string,
  primarySoft: string,
): string {
  if (primary.startsWith('#') && primary.length === 7) {
    return isCurrent ? `${primary}33` : `${primary}12`;
  }
  return primarySoft;
}

type RingSpec = {
  feature: ZoneFeature;
  featureIndex: number;
  ringIndex: number;
  coordinates: LatLng[];
};

function ringToLatLngs(ring: number[][]): LatLng[] {
  return ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

function collectRings(features: ZoneFeature[]): RingSpec[] {
  const specs: RingSpec[] = [];
  features.forEach((feature, featureIndex) => {
    const { geometry } = feature;
    if (geometry.type === 'Polygon') {
      geometry.coordinates.forEach((ring, ringIndex) => {
        specs.push({
          feature,
          featureIndex,
          ringIndex,
          coordinates: ringToLatLngs(ring),
        });
      });
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((polygon, polyIndex) => {
        polygon.forEach((ring, ringIndex) => {
          specs.push({
            feature,
            featureIndex,
            ringIndex: polyIndex * 1000 + ringIndex,
            coordinates: ringToLatLngs(ring),
          });
        });
      });
    }
  });
  return specs;
}

function formatClock(value: string): string {
  const [h, m] = value.split(':');
  return `${h ?? '00'}:${m ?? '00'}`;
}

function todayHoursLabel(feature: ZoneFeature): string | null {
  const today = feature.properties.today;
  if (!today) {
    return null;
  }
  return `${formatClock(today.starts_at)} – ${formatClock(today.ends_at)}`;
}

type ZonePropsWithMeta = ZoneFeature['properties'] & { zone_id?: number };

function zoneMetaFromFeature(feature: ZoneFeature): {
  zoneId: number | null;
  paymentModel: string | null;
} {
  const props = feature.properties as ZonePropsWithMeta;
  const zoneId = typeof props.zone_id === 'number' ? props.zone_id : null;
  const paymentModel = feature.properties.operator?.payment_model ?? null;
  return { zoneId, paymentModel };
}

function vehicleDetailLine(vehicle: Vehicle): string {
  const plate = vehicle.formatted_plate;
  const nickname = vehicle.nickname?.trim();
  if (nickname) {
    return `${plate} · ${nickname}`;
  }
  return plate;
}

function MyLocationIcon({ color }: { color: string }) {
  const line = { position: 'absolute' as const, backgroundColor: color };
  return (
    <View style={styles.locationIcon}>
      <View style={[line, { width: 2, height: 5, top: 0 }]} />
      <View style={[line, { width: 2, height: 5, bottom: 0 }]} />
      <View style={[line, { width: 5, height: 2, left: 0 }]} />
      <View style={[line, { width: 5, height: 2, right: 0 }]} />
      <View
        style={[
          styles.locationIconRing,
          { borderColor: color },
        ]}
      />
      <View style={[styles.locationIconDot, { backgroundColor: color }]} />
    </View>
  );
}

export default function MapScreen() {
  const { t } = useLocale();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const interLoaded = useInterLoaded();
  const mapRef = useRef<MapView>(null);

  const [features, setFeatures] = useState<ZoneFeature[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [cacheOffline, setCacheOffline] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [selected, setSelected] = useState<ZoneFeature | null>(null);

  const [banner, setBanner] = useState({
    insideZone: false,
    zoneCode: null as string | null,
    zoneName: null as string | null,
    operator: null as string | null,
    paid: false,
    paidUntil: null as string | null,
    zoneId: null as number | null,
    paymentModel: null as string | null,
  });

  const [lastFix, setLastFix] = useState<{
    lat: number;
    lng: number;
    accuracyM: number | null;
  } | null>(null);

  const [defaultVehicle, setDefaultVehicle] = useState<Vehicle | null>(null);
  const [activeSession, setActiveSession] = useState<ParkingSession | null>(
    null,
  );

  const featuresRef = useRef(features);
  const holidaysRef = useRef(holidays);
  const fetchedAtRef = useRef(0);

  useEffect(() => {
    featuresRef.current = features;
    holidaysRef.current = holidays;
  }, [features, holidays]);

  const rings = useMemo(() => collectRings(features), [features]);

  useEffect(() => {
    void (async () => {
      const cache = await loadZoneCache();
      setFeatures(cache.features);
      setHolidays(cache.holidays);
      setCacheOffline(cache.offline);
      fetchedAtRef.current = cache.fetchedAt;
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const data = await listVehicles();
        const vehicle = data.find((v) => v.is_default) ?? data[0] ?? null;
        setDefaultVehicle(vehicle);
      } catch {
        setDefaultVehicle(null);
      }
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const active = await getActiveSessions();
          setActiveSession(active[0] ?? null);
          const prepaid =
            active.find((s) => s.payment_model === 'prepaid') ?? null;
          const gradski =
            active.find((s) => s.payment_model === 'session') ?? null;
          void syncPrepaidExpiry(prepaid);
          void syncGradskiClockEnd(gradski);
          void syncStillParked(gradski);
        } catch {
          // leave map as it is
        }
      })();
    }, []),
  );

  useEffect(() => {
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationGranted(status === Location.PermissionStatus.GRANTED);
    })();
  }, []);

  const updateBannerFromLocal = useCallback(
    (latitude: number, longitude: number, accuracyM: number | null) => {
      const feats = featuresRef.current;
      const hols = holidaysRef.current;
      const { zoneCode, ambiguous } = zoneAt(
        feats,
        latitude,
        longitude,
        accuracyM,
      );

      const applyLocal = () => {
        if (!zoneCode) {
          setBanner({
            insideZone: false,
            zoneCode: null,
            zoneName: null,
            operator: null,
            paid: false,
            paidUntil: null,
            zoneId: null,
            paymentModel: null,
          });
          return;
        }
        const feature = feats.find((f) => f.properties.code === zoneCode);
        if (!feature) {
          setBanner({
            insideZone: false,
            zoneCode: null,
            zoneName: null,
            operator: null,
            paid: false,
            paidUntil: null,
            zoneId: null,
            paymentModel: null,
          });
          return;
        }
        const paid = paidNow(feature, Date.now(), hols);
        const endsAt = paidEndsAt(feature);
        const meta = zoneMetaFromFeature(feature);
        setBanner({
          insideZone: true,
          zoneCode,
          zoneName: feature.properties.name ?? null,
          operator: feature.properties.operator?.short_name ?? null,
          paid,
          paidUntil: endsAt ? formatClock(endsAt) : null,
          zoneId: meta.zoneId,
          paymentModel: meta.paymentModel,
        });
      };

      const cacheAge = Date.now() - fetchedAtRef.current;
      const needsLocate = ambiguous || cacheAge > LOCATE_CACHE_MAX_MS;

      applyLocal();

      if (!needsLocate) {
        return;
      }

      void (async () => {
        try {
          const response = await postLocate({
            lat: latitude,
            lng: longitude,
            accuracy_m: accuracyM,
          });

          if (!response.inside_zone) {
            setBanner({
              insideZone: false,
              zoneCode: null,
              zoneName: null,
              operator: null,
              paid: false,
              paidUntil: null,
              zoneId: null,
              paymentModel: null,
            });
            return;
          }

          const featsNow = featuresRef.current;
          const code = response.zone?.code ?? null;
          const feature = code
            ? featsNow.find((f) => f.properties.code === code)
            : undefined;
          const endsAt = feature ? paidEndsAt(feature) : null;
          const meta = feature ? zoneMetaFromFeature(feature) : null;

          setBanner({
            insideZone: true,
            zoneCode: code,
            zoneName:
              response.zone?.name ?? feature?.properties.name ?? null,
            operator:
              response.zone?.operator ??
              feature?.properties.operator?.short_name ??
              null,
            paid: response.paid_now,
            paidUntil: endsAt ? formatClock(endsAt) : null,
            zoneId: response.zone?.id ?? meta?.zoneId ?? null,
            paymentModel: meta?.paymentModel ?? null,
          });
        } catch {
          // keep local banner
        }
      })();
    },
    [],
  );

  useEffect(() => {
    if (!locationGranted) {
      return;
    }

    let subscription: Location.LocationSubscription | null = null;

    void (async () => {
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 10,
        },
        (fix) => {
          setLastFix({
            lat: fix.coords.latitude,
            lng: fix.coords.longitude,
            accuracyM: fix.coords.accuracy ?? null,
          });
          updateBannerFromLocal(
            fix.coords.latitude,
            fix.coords.longitude,
            fix.coords.accuracy ?? null,
          );
        },
      );
    })();

    return () => {
      subscription?.remove();
    };
  }, [locationGranted, updateBannerFromLocal]);

  const paymentLabel = (feature: ZoneFeature): string => {
    const model = feature.properties.operator?.payment_model;
    if (model === 'session') {
      return t('mapPaySession');
    }
    return t('mapPayPrepaid');
  };

  const operatorPaymentLine = useCallback(
    (operator: string | null, paymentModel: string | null): string | null => {
      if (!operator) {
        return null;
      }
      const payPart =
        paymentModel === 'session' ? t('mapPaySession') : t('mapPayPrepaid');
      return `${operator} · ${payPart}`;
    },
    [t],
  );

  const recenterOnFix = useCallback(() => {
    if (!lastFix) {
      return;
    }
    mapRef.current?.animateToRegion(
      {
        latitude: lastFix.lat,
        longitude: lastFix.lng,
        latitudeDelta: MAP_DELTA,
        longitudeDelta: MAP_DELTA,
      },
      300,
    );
  }, [lastFix]);

  const openSession = useCallback(() => {
    if (!activeSession) {
      return;
    }
    router.push({
      pathname: '/(app)/session',
      params: { sessionId: String(activeSession.id) },
    });
  }, [activeSession, router]);

  const payRouteParams = useCallback((): Record<string, string> | null => {
    if (!lastFix) {
      return null;
    }
    const params: Record<string, string> = {
      zoneCode: banner.zoneCode ?? '',
      lat: String(lastFix.lat),
      lng: String(lastFix.lng),
    };
    if (banner.zoneId !== null) {
      params.zoneId = String(banner.zoneId);
    }
    if (banner.paymentModel) {
      params.paymentModel = banner.paymentModel;
    }
    if (lastFix.accuracyM !== null) {
      params.accuracyM = String(lastFix.accuracyM);
    }
    return params;
  }, [banner, lastFix]);

  const openPay = useCallback(() => {
    const params = payRouteParams();
    if (!params) {
      return;
    }
    router.push({
      pathname: '/(app)/pay',
      params,
    });
  }, [payRouteParams, router]);

  const openPayOverride = useCallback(() => {
    const params = payRouteParams();
    if (!params) {
      return;
    }
    router.push({
      pathname: '/(app)/pay',
      params: { ...params, override: '1' },
    });
  }, [payRouteParams, router]);

  const hours = selected ? todayHoursLabel(selected) : null;
  const paidBanner =
    banner.insideZone && banner.paid && banner.zoneCode !== null;
  const operatorLine = operatorPaymentLine(
    banner.operator,
    banner.paymentModel,
  );
  const vehicleLine = defaultVehicle
    ? t('mapVehicleLine').replace(
        '{detail}',
        vehicleDetailLine(defaultVehicle),
      )
    : null;
  const sessionButtonLabel = activeSession
    ? activeSession.payment_model === 'prepaid'
      ? t('mapSessionExtend')
      : t('mapSessionStop')
    : null;
  const sessionPrimaryButton = activeSession ? (
    <Pressable
      accessibilityRole="button"
      onPress={openSession}
      style={[
        styles.payPrimaryButton,
        { backgroundColor: colors.primary },
      ]}
    >
      <AppText
        style={[
          styles.payPrimaryLabel,
          {
            color: isDark ? colors.textOnPrimary : '#FFFFFF',
            fontFamily: interLoaded ? 'Inter_600SemiBold' : undefined,
            fontWeight: '700',
          },
        ]}
      >
        {sessionButtonLabel}
      </AppText>
    </Pressable>
  ) : null;
  const chromeShadow = {
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  };

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          ...SKOPJE,
          latitudeDelta: MAP_DELTA,
          longitudeDelta: MAP_DELTA,
        }}
        showsUserLocation={locationGranted}
      >
        {rings.map((spec) => {
          const code = spec.feature.properties.code;
          const isCurrent =
            banner.zoneCode !== null && code === banner.zoneCode;
          const strokeColor = isCurrent
            ? colors.primary
            : isDark
              ? colors.primary
              : colors.primary600;
          return (
            <Polygon
              key={`${spec.featureIndex}-${spec.ringIndex}`}
              coordinates={spec.coordinates}
              fillColor={polygonFillColor(
                isCurrent,
                colors.primary,
                colors.primarySoft,
              )}
              strokeColor={strokeColor}
              strokeWidth={isCurrent ? 3 : 2}
              lineDashPattern={isCurrent ? undefined : [6, 5]}
              tappable
              onPress={() => setSelected(spec.feature)}
            />
          );
        })}
        {rings.map((spec) => {
          const code = spec.feature.properties.code;
          const isCurrent =
            banner.zoneCode !== null && code === banner.zoneCode;
          const labelBg = isCurrent ? colors.primary : colors.card;
          const labelText = isCurrent
            ? isDark
              ? colors.textOnPrimary
              : '#FFFFFF'
            : isDark
              ? colors.text
              : colors.primary;
          return (
            <Marker
              key={`label-${spec.featureIndex}-${spec.ringIndex}`}
              coordinate={ringCentroid(spec.coordinates)}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <View
                style={[
                  styles.zoneLabel,
                  {
                    backgroundColor: labelBg,
                    borderWidth: isCurrent ? 0 : 1,
                    borderColor: colors.border,
                  },
                ]}
              >
                <AppText
                  style={[
                    styles.zoneLabelText,
                    {
                      color: labelText,
                      fontFamily: interLoaded ? 'Inter_700Bold' : undefined,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {code}
                </AppText>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {selected ? (
        <Pressable style={styles.detailBackdrop} onPress={() => setSelected(null)}>
          <Pressable onPress={() => undefined}>
            <Card style={styles.detailCard}>
              <AppText variant="label">{selected.properties.code}</AppText>
              {selected.properties.name ? (
                <AppText>{selected.properties.name}</AppText>
              ) : null}
              {selected.properties.operator?.short_name ? (
                <AppText variant="muted">
                  {selected.properties.operator.short_name}
                </AppText>
              ) : null}
              {hours ? (
                <AppText variant="muted">
                  {t('mapTodayHours')}: {hours}
                </AppText>
              ) : null}
              <AppText>{paymentLabel(selected)}</AppText>
            </Card>
          </Pressable>
        </Pressable>
      ) : null}

      <View
        style={[styles.topChrome, { top: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.brandPill,
            { backgroundColor: isDark ? colors.card : '#FFFFFF' },
            !isDark && chromeShadow,
          ]}
        >
          {isDark ? (
            <View style={styles.brandMarkDarkWrap}>
              <Image
                source={require('../../../assets/smartpark-mark.png')}
                style={styles.brandMarkDarkImage}
                accessibilityIgnoresInvertColors
              />
            </View>
          ) : (
            <Image
              source={require('../../../assets/smartpark-mark.png')}
              style={styles.brandMark}
              accessibilityIgnoresInvertColors
            />
          )}
          <AppText
            style={[
              styles.brandTitle,
              {
                color: isDark ? colors.text : colors.primary,
                fontFamily: interLoaded ? 'Inter_700Bold' : undefined,
                fontWeight: '800',
              },
            ]}
          >
            {t('appName')}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mapMyLocation')}
          onPress={recenterOnFix}
          style={[
            styles.locateButton,
            { backgroundColor: isDark ? colors.card : '#FFFFFF' },
            !isDark && chromeShadow,
          ]}
        >
          <MyLocationIcon
            color={isDark ? colors.text : colors.primary}
          />
        </Pressable>
      </View>

      <View
        style={[
          styles.bannerWrap,
          { bottom: TAB_BAR_HEIGHT + insets.bottom + 12 },
        ]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: isDark ? colors.card : '#FFFFFF',
              borderColor: colors.border,
              borderWidth: isDark ? 1 : 0,
            },
            !isDark && chromeShadow,
          ]}
        >
          {cacheOffline ? (
            <AppText variant="label">{t('mapOffline')}</AppText>
          ) : null}
          {paidBanner ? (
            <>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusChip,
                    { backgroundColor: colors.paySoft },
                  ]}
                >
                  <View
                    style={[styles.statusDot, { backgroundColor: colors.pay }]}
                  />
                  <AppText
                    style={[styles.statusChipText, { color: colors.payText }]}
                  >
                    {t('mapPayingNow')}
                  </AppText>
                </View>
                {banner.paidUntil ? (
                  <AppText variant="muted" style={styles.paidUntilText}>
                    {t('mapPaidUntil').replace('{time}', banner.paidUntil)}
                  </AppText>
                ) : null}
              </View>
              <View style={styles.zoneRow}>
                <View
                  style={[
                    styles.zoneCodeBadge,
                    { backgroundColor: colors.primarySoft },
                  ]}
                >
                  <AppText
                    style={[
                      styles.zoneCodeText,
                      {
                        color: colors.primary,
                        fontFamily: interLoaded ? 'Inter_700Bold' : undefined,
                        fontWeight: '800',
                      },
                    ]}
                  >
                    {banner.zoneCode}
                  </AppText>
                </View>
                <View style={styles.zoneMeta}>
                  {banner.zoneName ? (
                    <AppText
                      style={[
                        styles.zoneName,
                        {
                          fontFamily: interLoaded
                            ? 'Inter_600SemiBold'
                            : undefined,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {banner.zoneName}
                    </AppText>
                  ) : null}
                  {operatorLine ? (
                    <AppText variant="muted" style={styles.operatorLine}>
                      {operatorLine}
                    </AppText>
                  ) : null}
                </View>
              </View>
              {activeSession ? (
                lastFix ? (
                  <View style={styles.payRow}>
                    {sessionPrimaryButton}
                    <Pressable
                      accessibilityRole="button"
                      onPress={openPayOverride}
                      style={[
                        styles.otherZoneButton,
                        {
                          borderColor: colors.border,
                          backgroundColor: isDark ? 'transparent' : '#FFFFFF',
                        },
                      ]}
                    >
                      <AppText
                        style={[
                          styles.otherZoneLabel,
                          {
                            color: isDark ? colors.text : colors.primary,
                            fontFamily: interLoaded
                              ? 'Inter_500Medium'
                              : undefined,
                            fontWeight: '600',
                          },
                        ]}
                      >
                        {t('mapOtherZone')}
                      </AppText>
                    </Pressable>
                  </View>
                ) : (
                  sessionPrimaryButton
                )
              ) : lastFix ? (
                <View style={styles.payRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={openPay}
                    style={[
                      styles.payPrimaryButton,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <AppText
                      style={[
                        styles.payPrimaryLabel,
                        {
                          color: isDark
                            ? colors.textOnPrimary
                            : '#FFFFFF',
                          fontFamily: interLoaded
                            ? 'Inter_600SemiBold'
                            : undefined,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {t('mapPayForParking')}
                    </AppText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={openPayOverride}
                    style={[
                      styles.otherZoneButton,
                      {
                        borderColor: colors.border,
                        backgroundColor: isDark ? 'transparent' : '#FFFFFF',
                      },
                    ]}
                  >
                    <AppText
                      style={[
                        styles.otherZoneLabel,
                        {
                          color: isDark ? colors.text : colors.primary,
                          fontFamily: interLoaded
                            ? 'Inter_500Medium'
                            : undefined,
                          fontWeight: '600',
                        },
                      ]}
                    >
                      {t('mapOtherZone')}
                    </AppText>
                  </Pressable>
                </View>
              ) : null}
              {vehicleLine ? (
                <AppText variant="muted" style={styles.vehicleLine}>
                  {vehicleLine}
                </AppText>
              ) : null}
            </>
          ) : banner.insideZone ? (
            <>
              <AppText variant="label">{t('mapFreeNow')}</AppText>
              <AppText>
                {[banner.zoneCode, banner.zoneName].filter(Boolean).join(' · ')}
              </AppText>
              {activeSession ? (
                <View style={styles.payRow}>{sessionPrimaryButton}</View>
              ) : null}
            </>
          ) : (
            <>
              <AppText variant="label">{t('mapNoPayHere')}</AppText>
              {activeSession ? (
                <View style={styles.payRow}>{sessionPrimaryButton}</View>
              ) : null}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  topChrome: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 999,
  },
  brandMark: {
    width: 30,
    height: 30,
  },
  brandMarkDarkWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkDarkImage: {
    width: 24,
    height: 24,
  },
  brandTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  locateButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationIcon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationIconRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  locationIconDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  bannerWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  statusCard: {
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  zoneLabel: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  zoneLabelText: {
    fontSize: 13,
    lineHeight: 16,
  },
  operatorLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  payPrimaryButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payPrimaryLabel: {
    fontSize: 17,
    lineHeight: 22,
  },
  otherZoneButton: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherZoneLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  vehicleLine: {
    fontSize: 13,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusChipText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  paidUntilText: {
    fontSize: 13,
    lineHeight: 18,
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  zoneCodeBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneCodeText: {
    fontSize: 20,
    lineHeight: 24,
  },
  zoneMeta: {
    flex: 1,
    gap: 2,
  },
  zoneName: {
    fontSize: 20,
    lineHeight: 26,
  },
  detailBackdrop: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  detailCard: {
    gap: 8,
    borderRadius: 24,
  },
});
