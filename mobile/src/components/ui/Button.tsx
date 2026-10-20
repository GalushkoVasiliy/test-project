import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

const variants: Record<Variant, { container: string; text: string; icon: string }> = {
  primary: { container: 'bg-brand-600 active:bg-brand-700', text: 'text-white', icon: '#ffffff' },
  secondary: {
    container: 'border border-slate-300 bg-white active:bg-slate-100',
    text: 'text-slate-800',
    icon: '#1e293b',
  },
  danger: { container: 'bg-red-600 active:bg-red-700', text: 'text-white', icon: '#ffffff' },
  ghost: { container: 'active:bg-slate-100', text: 'text-brand-600', icon: '#4f46e5' },
};

const sizes: Record<Size, { container: string; text: string }> = {
  sm: { container: 'px-3 py-2', text: 'text-sm' },
  md: { container: 'px-4 py-3', text: 'text-base' },
};

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  className,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const style = variants[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      className={cn(
        'flex-row items-center justify-center rounded-xl',
        sizes[size].container,
        style.container,
        isDisabled && 'opacity-50',
        className,
      )}
    >
      {loading ? (
        <ActivityIndicator size="small" color={style.icon} />
      ) : icon ? (
        <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={style.icon} />
      ) : null}
      <Text className={cn('font-semibold', sizes[size].text, style.text, (loading || icon) && 'ml-2')}>{title}</Text>
    </Pressable>
  );
}
