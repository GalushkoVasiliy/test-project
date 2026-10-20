import type { SectionStatus } from '@/api/types';
import { Badge, type BadgeTone } from '@/components/ui/Card';

const styles: Record<SectionStatus, { label: string; tone: BadgeTone }> = {
  Empty: { label: 'Not started', tone: 'slate' },
  Incomplete: { label: 'Draft · needs attention', tone: 'amber' },
  Complete: { label: 'Complete', tone: 'green' },
};

export function SectionStatusBadge({ status }: { status: SectionStatus }) {
  const { label, tone } = styles[status];
  return <Badge label={label} tone={tone} />;
}
