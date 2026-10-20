import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import type { DateOnly } from '@/api/types';
import { cn } from '@/lib/cn';
import { fromDateOnly, toDateOnly } from '@/lib/dates';
import { formatDate } from '@/lib/format';

import { Button } from './Button';

interface DateFieldProps {
  label: string;
  value: DateOnly | '' | null | undefined;
  onChange: (value: DateOnly) => void;
  error?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}

export function DateField({ label, value, onChange, error, minimumDate, maximumDate }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const date = value ? fromDateOnly(value) : (maximumDate ?? new Date());

  const show = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'date',
        minimumDate,
        maximumDate,
        onValueChange: (_, selected) => onChange(toDateOnly(selected)),
      });
    } else {
      setOpen((current) => !current);
    }
  };

  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-medium text-slate-700">{label}</Text>
      <Pressable
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDate(value) : 'not set'}`}
        className={cn(
          'flex-row items-center justify-between rounded-xl border bg-white px-3.5 py-3',
          error ? 'border-red-400' : 'border-slate-300',
        )}
      >
        <Text className={cn('text-base', value ? 'text-slate-900' : 'text-slate-400')}>
          {value ? formatDate(value) : 'Select a date'}
        </Text>
        <Ionicons name="calendar-outline" size={18} color="#64748b" />
      </Pressable>
      {open && Platform.OS === 'ios' ? (
        <View className="mt-2 rounded-xl border border-slate-200 bg-white p-2">
          <DateTimePicker
            value={date}
            mode="date"
            display="inline"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onValueChange={(_, selected) => onChange(toDateOnly(selected))}
          />
          <Button title="Done" variant="ghost" size="sm" onPress={() => setOpen(false)} />
        </View>
      ) : null}
      {error ? <Text className="mt-1 text-sm text-red-600">{error}</Text> : null}
    </View>
  );
}
