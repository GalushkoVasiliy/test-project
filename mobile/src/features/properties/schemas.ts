import { z } from 'zod';

const required = (message: string, max: number) =>
  z.string().trim().min(1, message).max(max, `Must be at most ${max} characters.`);

export const propertySchema = z.object({
  name: required('Name is required.', 120),
  address: required('Address is required.', 200),
  city: required('City is required.', 100),
});

export type PropertyForm = z.infer<typeof propertySchema>;

/** Numeric inputs are edited as text and parsed when the form is submitted. */
export const unitSchema = z.object({
  unitNumber: required('Unit number is required.', 20),
  bedrooms: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Enter a whole number.')
    .refine((v) => Number(v) <= 10, 'Bedrooms must be between 0 and 10.'),
  monthlyRent: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount, e.g. 1450 or 1450.50.')
    .refine((v) => Number(v) > 0, 'Monthly rent must be greater than 0.')
    .refine((v) => Number(v) <= 100_000, 'Monthly rent must be at most 100,000.'),
  unitTypeId: z.number({ error: 'Unit type is required.' }).int().positive('Unit type is required.'),
});

export type UnitForm = z.infer<typeof unitSchema>;
