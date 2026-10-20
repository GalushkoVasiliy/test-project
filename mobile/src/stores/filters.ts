import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ApplicationSortField, ApplicationStatus, SortDirection } from '@/api/types';

interface ApplicationFilters {
  status: ApplicationStatus | null;
  propertyId: string | null;
  sortBy: ApplicationSortField;
  sortDir: SortDirection;
}

interface UnitFilters {
  propertyId: string | null;
  minBedrooms: number | null;
}

interface FiltersState {
  applications: ApplicationFilters;
  units: UnitFilters;
  setApplicationFilters: (patch: Partial<ApplicationFilters>) => void;
  setUnitFilters: (patch: Partial<UnitFilters>) => void;
  reset: () => void;
}

const initial = {
  applications: { status: null, propertyId: null, sortBy: 'UpdatedAt', sortDir: 'Desc' } as ApplicationFilters,
  units: { propertyId: null, minBedrooms: null } as UnitFilters,
};

/** List filters and sort order (UI state), remembered between launches. */
export const useFiltersStore = create<FiltersState>()(
  persist(
    (set) => ({
      ...initial,
      setApplicationFilters: (patch) => set((s) => ({ applications: { ...s.applications, ...patch } })),
      setUnitFilters: (patch) => set((s) => ({ units: { ...s.units, ...patch } })),
      reset: () => set(initial),
    }),
    {
      name: 'rentals.filters',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ applications, units }) => ({ applications, units }),
    },
  ),
);
