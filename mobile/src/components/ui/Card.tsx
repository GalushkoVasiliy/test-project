import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/lib/cn';

// Colour variants are separate classes rather than overrides: NativeWind does not let a later
// className win over an earlier one (e.g. bg-amber-50 over bg-white).
const cardTones = {
  default: 'border-slate-200 bg-white',
  warning: 'border-amber-300 bg-amber-50',
  danger: 'border-red-200 bg-red-50',
} as const;

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  tone?: keyof typeof cardTones;
  className?: string;
  accessibilityLabel?: string;
}

export function Card({ children, onPress, tone = 'default', className, accessibilityLabel }: CardProps) {
  const classes = cn('mb-3 rounded-2xl border p-4', cardTones[tone], className);
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className={cn(classes, 'active:opacity-80')}
      >
        {children}
      </Pressable>
    );
  }
  return <View className={classes}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View className="mb-2 mt-2 flex-row items-center justify-between">
      <Text className="text-xs font-semibold uppercase tracking-wider text-slate-500">{children}</Text>
      {right}
    </View>
  );
}

const badgeTones = {
  slate: { bg: 'bg-slate-100', text: 'text-slate-700' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-800' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-800' },
  green: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  red: { bg: 'bg-red-100', text: 'text-red-800' },
} as const;

export type BadgeTone = keyof typeof badgeTones;

export function Badge({ label, tone = 'slate' }: { label: string; tone?: BadgeTone }) {
  const { bg, text } = badgeTones[tone];
  return (
    <View className={cn('self-start rounded-full px-2.5 py-0.5', bg)}>
      <Text className={cn('text-xs font-semibold', text)}>{label}</Text>
    </View>
  );
}
