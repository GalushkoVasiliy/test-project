import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, Text, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { FormTextField } from '@/components/ui/TextField';
import { AuthLayout, FormError } from '@/features/auth/AuthLayout';
import { signIn } from '@/features/auth/authService';
import { signInSchema, type SignInForm } from '@/features/auth/schemas';

/** Seeded accounts (see the backend seeder), offered in development builds only. */
const DEMO_ACCOUNTS = [
  { email: 'applicant@demo.test', label: 'Applicant' },
  { email: 'manager@demo.test', label: 'Property manager' },
];
const DEMO_PASSWORD = 'Demo123!';

export default function SignInScreen() {
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, setValue, formState } = useForm<SignInForm>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await signIn(email, password);
    } catch (error) {
      setFormError(errorMessage(error));
    }
  });

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to browse homes and manage rental applications.">
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
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => void onSubmit()}
      />
      <FormError message={formError} />
      <Button title="Sign in" onPress={onSubmit} loading={formState.isSubmitting} />

      <View className="mt-6 flex-row justify-center">
        <Text className="text-slate-500">New here? </Text>
        <Link href="/sign-up" asChild>
          <Text className="font-semibold text-brand-600">Create an account</Text>
        </Link>
      </View>

      {__DEV__ ? (
        <View className="mt-10 rounded-xl border border-dashed border-slate-300 p-3">
          <Text className="mb-2 text-xs font-semibold uppercase text-slate-500">Demo accounts</Text>
          {DEMO_ACCOUNTS.map((account) => (
            <Pressable
              key={account.email}
              onPress={() => {
                setValue('email', account.email);
                setValue('password', DEMO_PASSWORD);
              }}
              className="py-1.5"
            >
              <Text className="text-sm text-brand-600">
                {account.label} · {account.email}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </AuthLayout>
  );
}
