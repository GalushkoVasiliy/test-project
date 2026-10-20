import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerClassName="flex-grow justify-center p-6" keyboardShouldPersistTaps="handled">
          <View className="mb-8 items-center">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl bg-brand-600">
              <Ionicons name="home" size={28} color="#ffffff" />
            </View>
            <Text className="text-center text-2xl font-bold text-slate-900">{title}</Text>
            <Text className="mt-1 text-center text-slate-500">{subtitle}</Text>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View className="mb-4 flex-row items-start rounded-xl bg-red-50 p-3">
      <Ionicons name="alert-circle" size={18} color="#dc2626" />
      <Text className="ml-2 flex-1 text-sm text-red-700">{message}</Text>
    </View>
  );
}
