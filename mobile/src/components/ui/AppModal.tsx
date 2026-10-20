import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

interface AppModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** A sheet-style modal with a header, scrollable body and a sticky footer for actions. */
export function AppModal({ visible, title, onClose, children, footer }: AppModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-slate-50">
        <View className="flex-row items-center justify-between border-b border-slate-200 bg-white px-4 py-3.5">
          <Text className="flex-1 text-lg font-semibold text-slate-900" numberOfLines={1}>
            {title}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={24} color="#334155" />
          </Pressable>
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView className="flex-1" contentContainerClassName="p-4" keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View className="border-t border-slate-200 bg-white px-4 pb-8 pt-3">{footer}</View> : null}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
