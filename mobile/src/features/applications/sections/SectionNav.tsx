import { View } from 'react-native';

import { Button } from '@/components/ui/Button';

interface SectionNavProps {
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continuing?: boolean;
  onSaveDraft?: () => void;
  savingDraft?: boolean;
}

/**
 * Back returns to the previous section without saving; Continue saves the section only when it is
 * valid; Save draft keeps whatever was entered, errors included, so it can be finished later.
 */
export function SectionNav({
  onBack,
  onContinue,
  continueLabel = 'Continue',
  continuing,
  onSaveDraft,
  savingDraft,
}: SectionNavProps) {
  return (
    <View className="mb-4">
      <View className="flex-row">
        {onBack ? (
          <Button title="Back" variant="secondary" icon="arrow-back" className="mr-3 flex-1" onPress={onBack} />
        ) : null}
        {onContinue ? (
          <Button title={continueLabel} className="flex-1" onPress={onContinue} loading={continuing} />
        ) : null}
      </View>
      {onSaveDraft ? (
        <Button
          title="Save draft and finish later"
          variant="ghost"
          icon="save-outline"
          className="mt-2"
          onPress={onSaveDraft}
          loading={savingDraft}
        />
      ) : null}
    </View>
  );
}
