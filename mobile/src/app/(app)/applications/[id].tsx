import { useLocalSearchParams } from 'expo-router';

import { ApplicationScreen } from '@/features/applications/ApplicationScreen';

export default function ApplicationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ApplicationScreen id={id} />;
}
