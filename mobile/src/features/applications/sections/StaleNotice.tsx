import { useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { queryKeys } from '@/query/keys';

export const isStale = (error: unknown) => error instanceof ApiError && error.code === 'stale_section';

/**
 * Shown when someone else (e.g. a co-applicant) saved this section first. Reloading replaces the form
 * with their version; nothing is overwritten silently.
 */
export function StaleNotice({ applicationId }: { applicationId: string }) {
  const client = useQueryClient();
  return (
    <View className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3">
      <Text className="text-sm text-amber-900">
        Someone else saved this section while you were editing it. Reload to see their changes, then make yours again.
      </Text>
      <Button
        title="Reload latest"
        size="sm"
        variant="secondary"
        icon="refresh"
        className="mt-2 self-start"
        onPress={() => void client.invalidateQueries({ queryKey: queryKeys.applications.detail(applicationId) })}
      />
    </View>
  );
}
