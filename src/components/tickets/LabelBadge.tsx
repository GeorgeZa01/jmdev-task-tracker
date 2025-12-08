import { TicketLabel } from '@/types/ticket';
import { cn } from '@/lib/utils';

interface LabelBadgeProps {
  label: TicketLabel;
  className?: string;
}

const labelConfig: Record<TicketLabel, { bg: string; text: string }> = {
  bug: { bg: 'bg-[hsl(var(--label-bug)/0.15)]', text: 'text-[hsl(var(--label-bug))]' },
  feature: { bg: 'bg-[hsl(var(--label-feature)/0.15)]', text: 'text-[hsl(var(--label-feature))]' },
  enhancement: { bg: 'bg-[hsl(var(--label-enhancement)/0.15)]', text: 'text-[hsl(var(--label-enhancement))]' },
  documentation: { bg: 'bg-[hsl(var(--label-documentation)/0.15)]', text: 'text-[hsl(var(--label-documentation))]' },
  question: { bg: 'bg-[hsl(var(--label-question)/0.15)]', text: 'text-[hsl(var(--label-question))]' },
};

export function LabelBadge({ label, className }: LabelBadgeProps) {
  const config = labelConfig[label];

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium capitalize border border-current/20',
        config.bg,
        config.text,
        className
      )}
    >
      {label}
    </span>
  );
}
