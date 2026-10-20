import {
  onlineManager,
  useMutationState,
  useQueryClient,
  type MutationKey,
  type MutationMeta,
  type MutationScope,
} from '@tanstack/react-query';
import { useCallback, useState } from 'react';

/**
 * Runs a mutation registered in `mutations.ts`. The scope is derived from the variables (e.g. the id of a
 * record created right now), which plain `useMutation` cannot do, so changes to the same record are
 * queued and replayed in order.
 */
export function useChange<TData, TVars>(
  mutationKey: MutationKey,
  scopeFor: (variables: TVars) => MutationScope,
  meta?: MutationMeta,
) {
  const client = useQueryClient();
  const [running, setRunning] = useState(0);

  const mutateAsync = useCallback(
    (variables: TVars): Promise<TData> => {
      const mutation = client
        .getMutationCache()
        .build<TData, Error, TVars, unknown>(client, { mutationKey, scope: scopeFor(variables), meta });
      setRunning((n) => n + 1);
      return mutation.execute(variables).finally(() => setRunning((n) => n - 1));
    },
    [client, mutationKey, scopeFor, meta],
  );

  return { mutateAsync, isPending: running > 0 };
}

export type CommitResult<T> = { queued: true } | { queued: false; data: T };

/**
 * Online, waits for the server so the screen can show the result or the error in place. Offline, the
 * change is already applied optimistically and queued, so the screen can move on right away; a later
 * rejection is reported by the global mutation error handler.
 */
export async function commit<T>(change: Promise<T>): Promise<CommitResult<T>> {
  if (!onlineManager.isOnline()) {
    change.catch(() => undefined);
    return { queued: true };
  }
  return { queued: false, data: await change };
}

/** True while changes to this record are waiting to reach the server. */
export function useIsSyncing(scope: MutationScope): boolean {
  return (
    useMutationState({
      filters: { status: 'pending', predicate: (m) => m.options.scope?.id === scope.id },
      select: (m) => m.mutationId,
    }).length > 0
  );
}
