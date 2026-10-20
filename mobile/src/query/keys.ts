import type { ApplicationListParams } from '@/api/endpoints';

type ApplicationListFilters = Omit<ApplicationListParams, 'page'>;

export const queryKeys = {
  unitTypes: ['lookups', 'unit-types'] as const,
  properties: {
    all: ['properties'] as const,
    list: () => ['properties', 'list'] as const,
    detail: (id: string) => ['properties', 'detail', id] as const,
  },
  units: {
    all: ['units'] as const,
    available: (filters: { propertyId: string | null; minBedrooms: number | null }) =>
      ['units', 'available', filters] as const,
  },
  applications: {
    all: ['applications'] as const,
    lists: () => ['applications', 'list'] as const,
    list: (filters: ApplicationListFilters) => ['applications', 'list', filters] as const,
    detail: (id: string) => ['applications', 'detail', id] as const,
  },
};

/** Mutations with the same scope run one after another, in the order they were made — also when replayed. */
export const scopes = {
  property: (propertyId: string) => ({ id: `property:${propertyId}` }),
  application: (applicationId: string) => ({ id: `application:${applicationId}` }),
};
