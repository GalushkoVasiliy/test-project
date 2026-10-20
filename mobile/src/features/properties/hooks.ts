import { useQuery } from '@tanstack/react-query';

import { lookupsApi, propertiesApi } from '@/api/endpoints';
import type { PropertyDetails, Unit } from '@/api/types';
import { queryKeys, scopes } from '@/query/keys';
import {
  mutationKeys,
  type CreatePropertyVars,
  type CreateUnitVars,
  type DeletePropertyVars,
  type DeleteUnitVars,
  type UpdatePropertyVars,
  type UpdateUnitVars,
} from '@/query/mutations';
import { useChange } from '@/query/useChange';

const INLINE_ERRORS = { inlineErrors: true };

export const useProperties = () => useQuery({ queryKey: queryKeys.properties.list(), queryFn: propertiesApi.list });

export const usePropertyDetails = (id: string) =>
  useQuery({ queryKey: queryKeys.properties.detail(id), queryFn: () => propertiesApi.get(id) });

export const useUnitTypes = () =>
  useQuery({ queryKey: queryKeys.unitTypes, queryFn: lookupsApi.unitTypes, staleTime: 60 * 60 * 1000 });

export const useCreateProperty = () =>
  useChange<PropertyDetails, CreatePropertyVars>(
    mutationKeys.createProperty,
    (v) => scopes.property(v.id),
    INLINE_ERRORS,
  );

export const useUpdateProperty = () =>
  useChange<PropertyDetails, UpdatePropertyVars>(
    mutationKeys.updateProperty,
    (v) => scopes.property(v.id),
    INLINE_ERRORS,
  );

export const useDeleteProperty = () =>
  useChange<void, DeletePropertyVars>(mutationKeys.deleteProperty, (v) => scopes.property(v.id));

export const useCreateUnit = () =>
  useChange<Unit, CreateUnitVars>(mutationKeys.createUnit, (v) => scopes.property(v.propertyId), INLINE_ERRORS);

export const useUpdateUnit = () =>
  useChange<Unit, UpdateUnitVars>(mutationKeys.updateUnit, (v) => scopes.property(v.propertyId), INLINE_ERRORS);

export const useDeleteUnit = () =>
  useChange<void, DeleteUnitVars>(mutationKeys.deleteUnit, (v) => scopes.property(v.propertyId), INLINE_ERRORS);
