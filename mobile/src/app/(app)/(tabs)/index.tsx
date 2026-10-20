import { AvailableUnitsScreen } from '@/features/units/AvailableUnitsScreen';
import { PropertiesScreen } from '@/features/properties/PropertiesScreen';
import { useIsManager } from '@/stores/session';

export default function HomeTab() {
  return useIsManager() ? <PropertiesScreen /> : <AvailableUnitsScreen />;
}
