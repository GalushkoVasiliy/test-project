import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import type { PagedResult, SortDirection } from '@/api/types';
import { cn } from '@/lib/cn';

import { EmptyState, ErrorState, PendingState } from './ui/StateViews';

export interface GridColumn<T, TSort extends string> {
  key: string;
  title: string;
  /** Relative width. */
  flex?: number;
  align?: 'left' | 'right';
  /** Sortable when set: the server-side sort field. */
  sortField?: TSort;
  render: (row: T) => ReactNode;
}

export interface GridSort<TSort extends string> {
  field: TSort;
  direction: SortDirection;
}

interface DataGridProps<T, TSort extends string> {
  /** Identifies the data set, including filters. Sorting is appended automatically. */
  queryKey: QueryKey;
  /** Fetches one page from a JSON endpoint that returns the rows and the filtered total. */
  fetchPage: (args: {
    page: number;
    pageSize: number;
    sort: GridSort<TSort>;
    signal: AbortSignal;
  }) => Promise<PagedResult<T>>;
  columns: GridColumn<T, TSort>[];
  sort: GridSort<TSort>;
  onSortChange: (sort: GridSort<TSort>) => void;
  rowKey: (row: T) => string;
  onRowPress?: (row: T) => void;
  pageSize?: number;
  /** Rendered above the column headers (filters). */
  header?: ReactElement;
  /** Extra rows shown above the server rows, e.g. records created offline that have not synced yet. */
  pendingRows?: ReactElement | null;
  emptyTitle: string;
  emptyMessage?: string;
}

/**
 * Reusable paged grid. Paging and sorting happen on the server; pages load as the user scrolls and the
 * footer shows how many of the filtered total are loaded.
 */
export function DataGrid<T, TSort extends string>({
  queryKey,
  fetchPage,
  columns,
  sort,
  onSortChange,
  rowKey,
  onRowPress,
  pageSize = 20,
  header,
  pendingRows,
  emptyTitle,
  emptyMessage,
}: DataGridProps<T, TSort>) {
  const query = useInfiniteQuery({
    queryKey: [...queryKey, sort],
    queryFn: ({ pageParam, signal }) => fetchPage({ page: pageParam, pageSize, sort, signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.totalCount ? last.page + 1 : undefined),
  });

  const rows = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages.at(-1)?.totalCount ?? 0;

  const toggleSort = (field: TSort) =>
    onSortChange({
      field,
      direction: sort.field === field && sort.direction === 'Desc' ? 'Asc' : 'Desc',
    });

  const columnHeader = (
    <View className="flex-row border-b border-slate-200 bg-slate-100 px-4 py-2">
      {columns.map((column) => {
        const active = column.sortField !== undefined && column.sortField === sort.field;
        const content = (
          <View className={cn('flex-row items-center', column.align === 'right' && 'justify-end')}>
            <Text
              className={cn(
                'text-xs font-semibold uppercase tracking-wide',
                active ? 'text-brand-700' : 'text-slate-500',
              )}
            >
              {column.title}
            </Text>
            {active ? (
              <Ionicons
                name={sort.direction === 'Asc' ? 'arrow-up' : 'arrow-down'}
                size={12}
                color="#4338ca"
                style={{ marginLeft: 2 }}
              />
            ) : null}
          </View>
        );
        return (
          <View key={column.key} style={{ flex: column.flex ?? 1 }}>
            {column.sortField ? (
              <Pressable
                onPress={() => toggleSort(column.sortField!)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Sort by ${column.title}`}
              >
                {content}
              </Pressable>
            ) : (
              content
            )}
          </View>
        );
      })}
    </View>
  );

  if (query.isPending) {
    return (
      <View className="flex-1">
        {header}
        <PendingState paused={query.fetchStatus === 'paused'} />
      </View>
    );
  }

  if (query.isError && rows.length === 0) {
    return (
      <View className="flex-1">
        {header}
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={rowKey}
      ListHeaderComponent={
        <View className="bg-slate-50">
          {header}
          {columnHeader}
          {pendingRows}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={onRowPress ? () => onRowPress(item) : undefined}
          accessibilityRole={onRowPress ? 'button' : undefined}
          className="flex-row items-center border-b border-slate-100 bg-white px-4 py-3 active:bg-slate-50"
        >
          {columns.map((column) => (
            <View
              key={column.key}
              style={{ flex: column.flex ?? 1 }}
              className={cn('pr-2', column.align === 'right' && 'items-end pr-0')}
            >
              {column.render(item)}
            </View>
          ))}
        </Pressable>
      )}
      ListEmptyComponent={pendingRows ? undefined : <EmptyState title={emptyTitle} message={emptyMessage} />}
      ListFooterComponent={
        <View className="items-center py-4">
          {query.isFetchingNextPage ? (
            <ActivityIndicator color="#4f46e5" />
          ) : rows.length > 0 ? (
            <Text className="text-xs text-slate-500">
              Showing {rows.length} of {total}
            </Text>
          ) : null}
        </View>
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching && !query.isFetchingNextPage}
          onRefresh={() => void query.refetch()}
        />
      }
    />
  );
}
