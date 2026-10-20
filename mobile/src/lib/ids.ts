import { randomUUID } from 'expo-crypto';

/** Ids are generated on the device so records can be created offline and replayed without duplicates. */
export const newId = (): string => randomUUID();
