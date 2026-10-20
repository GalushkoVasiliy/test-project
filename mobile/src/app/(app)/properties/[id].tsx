import { useLocalSearchParams } from 'expo-router';

import { PropertyDetailsScreen } from '@/features/properties/PropertyDetailsScreen';

export default function PropertyRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PropertyDetailsScreen id={id} />;
}
