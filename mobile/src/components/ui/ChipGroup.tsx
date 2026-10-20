import { Pressable, ScrollView, Text, View } from 'react-native';

import { cn } from '@/lib/cn';

export interface ChipOption<T> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface ChipGroupProps<T> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  /** Scroll horizontally instead of wrapping. */
  scroll?: boolean;
  error?: string;
}

/** Single-select chips: filters, segmented choices and small lookups. */
export function ChipGroup<T extends string | number | null>({
  options,
  value,
  onChange,
  label,
  scroll,
  error,
}: ChipGroupProps<T>) {
  const chips = options.map((option) => {
    const selected = option.value === value;
    return (
      <Pressable
        key={String(option.value)}
        onPress={() => onChange(option.value)}
        disabled={option.disabled}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled: !!option.disabled }}
        className={cn(
          'mb-2 mr-2 rounded-full border px-3.5 py-1.5',
          selected ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white',
          option.disabled && 'opacity-40',
        )}
      >
        <Text className={cn('text-sm font-medium', selected ? 'text-white' : 'text-slate-700')}>{option.label}</Text>
      </Pressable>
    );
  });

  return (
    <View className="mb-2">
      {label ? <Text className="mb-1.5 text-sm font-medium text-slate-700">{label}</Text> : null}
      {scroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {chips}
        </ScrollView>
      ) : (
        <View className="flex-row flex-wrap">{chips}</View>
      )}
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
    </View>
  );
}
