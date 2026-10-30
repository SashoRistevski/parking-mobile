import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import {
  ApiError,
  displayErrorMessage,
  fieldErrorMessage,
} from '../api/errors';
import {
  createVehicle,
  deleteVehicle,
  updateVehicle,
} from '../api/vehicles';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useLocale } from '../i18n/LocaleProvider';
import { useTheme } from '../theme/ThemeProvider';
import { formatPlateInput } from './formatPlateInput';

export type VehicleFormInitialValues = {
  vehicle_make: string;
  vehicle_model: string;
  license_plate: string;
  nickname: string;
  default_park_time: string;
};

type VehicleFormProps = {
  vehicleId?: number;
  initialValues?: VehicleFormInitialValues;
  beforeCreate?: () => void | Promise<void>;
  onSaved?: () => void | Promise<void>;
};

const emptyValues: VehicleFormInitialValues = {
  vehicle_make: '',
  vehicle_model: '',
  license_plate: '',
  nickname: '',
  default_park_time: '',
};

function parseDefaultParkTime(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const value = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(value)) {
    return NaN;
  }
  return value;
}

export function VehicleForm({
  vehicleId,
  initialValues,
  beforeCreate,
  onSaved,
}: VehicleFormProps) {
  const { t } = useLocale();
  const { colors } = useTheme();
  const router = useRouter();
  const isEdit = vehicleId != null;

  const [vehicleMake, setVehicleMake] = useState(
    initialValues?.vehicle_make ?? emptyValues.vehicle_make,
  );
  const [vehicleModel, setVehicleModel] = useState(
    initialValues?.vehicle_model ?? emptyValues.vehicle_model,
  );
  const [licensePlate, setLicensePlate] = useState(
    initialValues?.license_plate ?? emptyValues.license_plate,
  );
  const [nickname, setNickname] = useState(
    initialValues?.nickname ?? emptyValues.nickname,
  );
  const [defaultParkTime, setDefaultParkTime] = useState(
    initialValues?.default_park_time ?? emptyValues.default_park_time,
  );
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function fieldError(field: string): string | undefined {
    return apiError ? fieldErrorMessage(apiError, field) : undefined;
  }

  function onPlateChange(text: string) {
    setLicensePlate(formatPlateInput(text));
  }

  async function onSave() {
    setApiError(null);
    setGeneralError(null);
    setSubmitting(true);

    const hours = parseDefaultParkTime(defaultParkTime);
    const default_park_time =
      hours === null || Number.isNaN(hours) ? null : hours;
    const body = {
      vehicle_make: vehicleMake.trim(),
      vehicle_model: vehicleModel.trim(),
      license_plate: licensePlate,
      nickname: nickname.trim() ? nickname.trim() : null,
      default_park_time,
    };

    try {
      if (isEdit) {
        await updateVehicle(vehicleId, body);
        router.back();
      } else {
        if (beforeCreate) {
          await beforeCreate();
        }
        await createVehicle(body);
        if (onSaved) {
          await onSaved();
        } else {
          router.back();
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err);
        setGeneralError(displayErrorMessage(err));
      } else {
        setApiError(null);
        setGeneralError(displayErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function onDeletePress() {
    if (!isEdit || vehicleId == null) {
      return;
    }

    Alert.alert(t('deleteVehicle'), t('deleteVehicleConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('deleteVehicle'),
        style: 'destructive',
        onPress: () => void onDeleteConfirmed(),
      },
    ]);
  }

  async function onDeleteConfirmed() {
    if (vehicleId == null) {
      return;
    }
    setApiError(null);
    setGeneralError(null);
    setDeleting(true);
    try {
      await deleteVehicle(vehicleId);
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setApiError(err);
        setGeneralError(err.message);
      } else if (err instanceof ApiError) {
        setApiError(err);
        setGeneralError(displayErrorMessage(err));
      } else {
        setApiError(null);
        setGeneralError(displayErrorMessage(err));
      }
    } finally {
      setDeleting(false);
    }
  }

  const busy = submitting || deleting;

  return (
    <View style={styles.form}>
      <TextField
        autoCapitalize="words"
        placeholder={t('vehicleMake')}
        value={vehicleMake}
        onChangeText={setVehicleMake}
        editable={!busy}
      />
      {fieldError('vehicle_make') ? (
        <AppText variant="body" style={{ color: colors.pay }}>
          {fieldError('vehicle_make')}
        </AppText>
      ) : null}

      <TextField
        autoCapitalize="words"
        placeholder={t('vehicleModel')}
        value={vehicleModel}
        onChangeText={setVehicleModel}
        editable={!busy}
      />
      {fieldError('vehicle_model') ? (
        <AppText variant="body" style={{ color: colors.pay }}>
          {fieldError('vehicle_model')}
        </AppText>
      ) : null}

      <TextField
        autoCapitalize="characters"
        placeholder={t('licensePlate')}
        value={licensePlate}
        onChangeText={onPlateChange}
        editable={!busy}
      />
      {fieldError('license_plate') ? (
        <AppText variant="body" style={{ color: colors.pay }}>
          {fieldError('license_plate')}
        </AppText>
      ) : null}

      <TextField
        autoCapitalize="sentences"
        placeholder={t('nicknameOptional')}
        value={nickname}
        onChangeText={setNickname}
        editable={!busy}
      />
      {fieldError('nickname') ? (
        <AppText variant="body" style={{ color: colors.pay }}>
          {fieldError('nickname')}
        </AppText>
      ) : null}

      <TextField
        keyboardType="number-pad"
        placeholder={t('defaultPocHours')}
        value={defaultParkTime}
        onChangeText={setDefaultParkTime}
        editable={!busy}
      />
      {fieldError('default_park_time') ? (
        <AppText variant="body" style={{ color: colors.pay }}>
          {fieldError('default_park_time')}
        </AppText>
      ) : null}

      {generalError ? (
        <AppText variant="body" style={{ color: colors.pay }}>
          {generalError}
        </AppText>
      ) : null}

      <Button
        title={submitting ? t('saving') : t('save')}
        onPress={() => void onSave()}
        disabled={busy}
      />

      {isEdit ? (
        <Button
          title={deleting ? t('deleting') : t('deleteVehicle')}
          onPress={onDeletePress}
          disabled={busy}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 12,
  },
});
