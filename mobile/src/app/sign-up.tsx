import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { FormTextField } from '@/components/ui/TextField';
import { AuthLayout, FormError } from '@/features/auth/AuthLayout';
import { signUp } from '@/features/auth/authService';
import { signUpSchema, type SignUpForm } from '@/features/auth/schemas';
import { applyServerErrors } from '@/lib/serverErrors';

const FIELDS = ['fullName', 'email', 'password', 'role'] as const;

export default function SignUpScreen() {
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setError, formState } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', password: '', role: 'Applicant' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signUp(values);
    } catch (error) {
      const unmatched = applyServerErrors(error, setError, FIELDS);
      setFormError(unmatched[0] ?? null);
    }
  });

  return (
    <AuthLayout title="Create your account" subtitle="Apply for apartments or manage your properties.">
      <Controller
        control={control}
        name="role"
        render={({ field }) => (
          <ChipGroup
            label="I am"
            value={field.value}
            onChange={field.onChange}
            options={[
              { value: 'Applicant', label: 'Looking for a home' },
              { value: 'PropertyManager', label: 'A property manager' },
            ]}
          />
        )}
      />
      <FormTextField control={control} name="fullName" label="Full name" autoComplete="name" textContentType="name" />
      <FormTextField
        control={control}
        name="email"
        label="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <FormTextField
        control={control}
        name="password"
        label="Password"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint="At least 8 characters with upper- and lowercase letters and a digit."
      />
      <FormError message={formError} />
      <Button title="Create account" onPress={onSubmit} loading={formState.isSubmitting} />

      <View className="mt-6 flex-row justify-center">
        <Text className="text-slate-500">Already have an account? </Text>
        <Link href="/sign-in" asChild>
          <Text className="font-semibold text-brand-600">Sign in</Text>
        </Link>
      </View>
    </AuthLayout>
  );
}
