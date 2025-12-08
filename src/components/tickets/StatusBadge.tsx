import { TicketStatus } from '@/types/ticket';
import { cn } from '@/lib/utils';
import { CircleDot, CheckCircle2 } from 'lucide-react';

interface StatusBadgeProps {
  status: TicketStatus;
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({ status, showIcon = true, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium',
        status === 'open'
          ? 'bg-[hsl(var(--status-open))] text-[hsl(var(--status-open-foreground))]'
          : 'bg-[hsl(var(--status-closed))] text-[hsl(var(--status-closed-foreground))]',
        className
      )}
    >
      {showIcon && (
        status === 'open' ? (
          <CircleDot className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )
      )}
      {status === 'open' ? 'Open' : 'Closed'}
    </span>
  );
}
