import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { applicationsApi } from '@/api/endpoints';
import {
  APPLICATION_STATUSES,
  type ApplicationListItem,
  type ApplicationSortField,
  type ApplicationStatus,
} from '@/api/types';
import { DataGrid, type GridColumn } from '@/components/DataGrid';
import { Screen } from '@/components/Screen';
import { Badge } from '@/components/ui/Card';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { useProperties } from '@/features/properties/hooks';
import { formatDateTime } from '@/lib/format';
import { queryKeys } from '@/query/keys';
import { useFiltersStore } from '@/stores/filters';
import { useIsManager } from '@/stores/session';

import { StatusBadge, statusLabel } from './components/StatusBadge';
import { usePendingApplications } from './hooks';

type Column = GridColumn<ApplicationListItem, ApplicationSortField>;

const shortDate = (value: string) => formatDateTime(value).replace(/, \d{4}/, '');

const columns = {
  applicant: {
    key: 'applicant',
    title: 'Applicant',
    flex: 1.6,
    sortField: 'Applicant',
    render: (row) => (
      <View>
        <Text className="font-semibold text-slate-900" numberOfLines={1}>
          {row.applicantName || '—'}
          {row.coApplicantCount > 0 ? (
            <Text className="font-normal text-slate-500"> +{row.coApplicantCount}</Text>
          ) : null}
        </Text>
        <Text className="text-xs text-slate-500" numberOfLines={1}>
          {row.propertyName} · {row.unitNumber}
        </Text>
      </View>
    ),
  },
  property: {
    key: 'property',
    title: 'Home',
    flex: 1.6,
    sortField: 'Property',
    render: (row) => (
      <View>
        <Text className="font-semibold text-slate-900" numberOfLines={1}>
          {row.propertyName}
        </Text>
        <Text className="text-xs text-slate-500">
          Unit {row.unitNumber}
          {row.coApplicantCount > 0 ? ` · shared with ${row.coApplicantCount}` : ''}
        </Text>
      </View>
    ),
  },
  status: {
    key: 'status',
    title: 'Status',
    flex: 1.1,
    sortField: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
  updated: {
    key: 'updated',
    title: 'Updated',
    flex: 0.9,
    align: 'right',
    sortField: 'UpdatedAt',
    render: (row) => <Text className="text-xs text-slate-500">{shortDate(row.updatedAt)}</Text>,
  },
} satisfies Record<string, Column>;

export function ApplicationsScreen() {
  const isManager = useIsManager();
  const filters = useFiltersStore((s) => s.applications);
  const setFilters = useFiltersStore((s) => s.setApplicationFilters);
  const properties = useProperties();
  const pending = usePendingApplications();

  const statusOptions: { value: ApplicationStatus | null; label: string }[] = [
    { value: null, label: 'All' },
    ...APPLICATION_STATUSES.map((s) => ({
      value: s,
      label: isManager && s === 'Submitted' ? 'Review queue' : statusLabel(s),
    })),
  ];

  const header = (
    <View className="px-4 pt-3">
      <ChipGroup scroll value={filters.status} onChange={(status) => setFilters({ status })} options={statusOptions} />
      <ChipGroup
        scroll
        value={filters.propertyId}
        onChange={(propertyId) => setFilters({ propertyId })}
        options={[
          { value: null, label: 'All properties' },
          ...(properties.data ?? []).map((p) => ({ value: p.id, label: p.name })),
        ]}
      />
    </View>
  );

  const pendingRows =
    pending.length > 0 ? (
      <View>
        {pending.map((p) => (
          <View
            key={p.id}
            className="flex-row items-center justify-between border-b border-slate-100 bg-amber-50 px-4 py-3"
          >
            <Text className="flex-1 font-semibold text-slate-900" onPress={() => router.push(`/applications/${p.id}`)}>
              {p.unit.propertyName} · Unit {p.unit.unitNumber}
            </Text>
            <Badge label="Waiting to sync" tone="amber" />
          </View>
        ))}
      </View>
    ) : null;

  return (
    <Screen>
      <DataGrid
        queryKey={queryKeys.applications.list({
          status: filters.status,
          propertyId: filters.propertyId,
          pageSize: 20,
          sortBy: filters.sortBy,
          sortDir: filters.sortDir,
        })}
        fetchPage={({ page, pageSize, sort, signal }) =>
          applicationsApi.list(
            {
              status: filters.status,
              propertyId: filters.propertyId,
              page,
              pageSize,
              sortBy: sort.field,
              sortDir: sort.direction,
            },
            signal,
          )
        }
        columns={
          isManager
            ? [columns.applicant, columns.status, columns.updated]
            : [columns.property, columns.status, columns.updated]
        }
        sort={{ field: filters.sortBy, direction: filters.sortDir }}
        onSortChange={({ field, direction }) => setFilters({ sortBy: field, sortDir: direction })}
        rowKey={(row) => row.id}
        onRowPress={(row) => router.push(`/applications/${row.id}`)}
        header={header}
        pendingRows={pendingRows}
        emptyTitle="No applications"
        emptyMessage={isManager ? 'Nothing matches these filters.' : 'Browse available homes and apply for one.'}
      />
    </Screen>
  );
}
