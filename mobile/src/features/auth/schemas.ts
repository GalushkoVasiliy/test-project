import { z } from 'zod';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const signInSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.').regex(EMAIL_PATTERN, 'Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export type SignInForm = z.infer<typeof signInSchema>;

// Mirrors the ASP.NET Identity password options configured on the server.
export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.').max(100, 'Must be at most 100 characters.'),
  email: z.string().trim().min(1, 'Email is required.').regex(EMAIL_PATTERN, 'Enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .regex(/[a-z]/, 'Password needs a lowercase letter.')
    .regex(/[A-Z]/, 'Password needs an uppercase letter.')
    .regex(/\d/, 'Password needs a digit.'),
  role: z.enum(['Applicant', 'PropertyManager']),
});

export type SignUpForm = z.infer<typeof signUpSchema>;
