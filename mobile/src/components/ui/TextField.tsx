import type { ComponentRef, Ref } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

export function TextField({ label, error, hint, containerClassName, multiline, ref, ...props }: TextFieldProps) {
  return (
    <View className={cn('mb-4', containerClassName)}>
      {label ? <Text className="mb-1.5 text-sm font-medium text-slate-700">{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor="#94a3b8"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        accessibilityLabel={label}
        className={cn(
          'rounded-xl border bg-white px-3.5 py-3 text-base text-slate-900',
          error ? 'border-red-400' : 'border-slate-300',
          multiline && 'min-h-[96px]',
        )}
        {...props}
      />
      {error ? (
        <Text className="mt-1 text-sm text-red-600">{error}</Text>
      ) : hint ? (
        <Text className="mt-1 text-xs text-slate-500">{hint}</Text>
      ) : null}
    </View>
  );
}

type FormTextFieldProps<T extends FieldValues> = Omit<TextFieldProps, 'value' | 'onChangeText' | 'onBlur' | 'error'> & {
  control: Control<T>;
  name: Path<T>;
};

/** A TextField bound to react-hook-form; shows the field's validation error. */
export function FormTextField<T extends FieldValues>({ control, name, ...props }: FormTextFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...props}
          ref={field.ref}
          value={field.value == null ? '' : String(field.value)}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}

/** Read-only label/value pair, used when the server says a section is not editable. */
export function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="mb-3">
      <Text className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</Text>
      <Text className="mt-0.5 text-base text-slate-900">{value || '—'}</Text>
    </View>
  );
}
