import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import { API_URL } from '@/api/config';
import { usePendingChangesCount } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/format';
import { useCurrentUser } from '@/stores/session';
import { useIsOnline, useSyncStore } from '@/stores/sync';

import { signOut } from './authService';

export function AccountScreen() {
  const user = useCurrentUser();
  const online = useIsOnline();
  const pending = usePendingChangesCount();
  const { rejected, forcedOffline, setForcedOffline, dismissRejected, clearRejected } = useSyncStore();

  const onSignOut = () => {
    if (pending === 0) {
      void signOut();
      return;
    }
    Alert.alert(
      'Discard unsynced changes?',
      `You have ${pending} change${pending === 1 ? '' : 's'} that ${pending === 1 ? 'has' : 'have'} not reached the server yet. Signing out discards them.`,
      [
        { text: 'Stay signed in', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ],
    );
  };

  return (
    <Screen scroll>
      <Card>
        <Text className="text-lg font-semibold text-slate-900">{user?.fullName}</Text>
        <Text className="mt-0.5 text-slate-500">{user?.email}</Text>
        <Text className="mt-2 text-sm font-medium text-brand-700">
          {user?.role === 'PropertyManager' ? 'Property manager' : 'Applicant'}
        </Text>
      </Card>

      <SectionTitle>Sync</SectionTitle>
      <Card>
        <Row
          icon={online ? 'cloud-done-outline' : 'cloud-offline-outline'}
          label="Connection"
          value={online ? 'Online' : 'Offline'}
        />
        <Row icon="sync-outline" label="Waiting to sync" value={String(pending)} />
        {__DEV__ ? (
          <View className="mt-2 flex-row items-center justify-between border-t border-slate-100 pt-3">
            <View className="flex-1 pr-3">
              <Text className="font-medium text-slate-900">Simulate offline</Text>
              <Text className="text-xs text-slate-500">
                Development only. Queues changes as if the network were down.
              </Text>
            </View>
            <Switch value={forcedOffline} onValueChange={setForcedOffline} />
          </View>
        ) : null}
      </Card>

      {rejected.length > 0 ? (
        <>
          <SectionTitle right={<Button title="Clear" size="sm" variant="ghost" onPress={clearRejected} />}>
            Changes not saved ({rejected.length})
          </SectionTitle>
          {rejected.map((change) => (
            <Card key={change.id} tone="danger">
              <View className="flex-row items-start">
                <Ionicons name="alert-circle" size={20} color="#dc2626" />
                <View className="ml-3 flex-1">
                  <Text className="font-semibold text-red-900">{change.title}</Text>
                  <Text className="mt-0.5 text-sm text-red-800">{change.message}</Text>
                  <Text className="mt-1 text-xs text-red-700">{formatDateTime(new Date(change.at).toISOString())}</Text>
                </View>
                <Pressable onPress={() => dismissRejected(change.id)} hitSlop={10} accessibilityLabel="Dismiss">
                  <Ionicons name="close" size={18} color="#991b1b" />
                </Pressable>
              </View>
            </Card>
          ))}
        </>
      ) : null}

      <Button title="Sign out" variant="secondary" icon="log-out-outline" className="mt-4" onPress={onSignOut} />
      {__DEV__ ? <Text className="mt-6 text-center text-xs text-slate-400">API: {API_URL}</Text> : null}
    </Screen>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: 'cloud-done-outline' | 'cloud-offline-outline' | 'sync-outline';
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center py-1.5">
      <Ionicons name={icon} size={18} color="#475569" />
      <Text className="ml-2 flex-1 text-slate-700">{label}</Text>
      <Text className="font-medium text-slate-900">{value}</Text>
    </View>
  );
}
