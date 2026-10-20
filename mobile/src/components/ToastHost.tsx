import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';
import { useToastStore, type Toast } from '@/stores/toast';

const TOAST_MS = 5000;

const tones = {
  success: { container: 'bg-emerald-600', icon: 'checkmark-circle' },
  error: { container: 'bg-red-600', icon: 'alert-circle' },
  info: { container: 'bg-slate-800', icon: 'information-circle' },
} as const;

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 px-4" style={{ top: insets.top + 8 }}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </View>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const tone = tones[toast.kind];

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [dismiss, toast.id]);

  return (
    <Pressable
      onPress={() => dismiss(toast.id)}
      accessibilityRole="alert"
      className={cn('mb-2 flex-row items-start rounded-xl px-4 py-3 shadow-lg', tone.container)}
    >
      <Ionicons name={tone.icon} size={20} color="#ffffff" />
      <View className="ml-3 flex-1">
        <Text className="font-semibold text-white">{toast.title}</Text>
        {toast.message ? <Text className="mt-0.5 text-sm text-white/90">{toast.message}</Text> : null}
      </View>
    </Pressable>
  );
}
