import type { ApplicationStatus } from '@/api/types';
import { Badge, type BadgeTone } from '@/components/ui/Card';

const statusStyle: Record<ApplicationStatus, { label: string; tone: BadgeTone }> = {
  Draft: { label: 'Draft', tone: 'slate' },
  Submitted: { label: 'Submitted', tone: 'blue' },
  UnderReview: { label: 'Under review', tone: 'indigo' },
  Returned: { label: 'Returned', tone: 'amber' },
  Approved: { label: 'Approved', tone: 'green' },
  Denied: { label: 'Denied', tone: 'red' },
  Withdrawn: { label: 'Withdrawn', tone: 'slate' },
};

export const statusLabel = (status: ApplicationStatus) => statusStyle[status].label;

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const { label, tone } = statusStyle[status];
  return <Badge label={label} tone={tone} />;
}
