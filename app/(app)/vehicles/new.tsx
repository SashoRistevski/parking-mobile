import { Screen } from '../../../src/components/Screen';
import { VehicleForm } from '../../../src/vehicles/VehicleForm';

export default function NewVehicleScreen() {
  return (
    <Screen scroll includeTopInset={false}>
      <VehicleForm />
    </Screen>
  );
}
