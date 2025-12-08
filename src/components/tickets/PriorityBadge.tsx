import { TicketPriority } from '@/types/ticket';
import { cn } from '@/lib/utils';
import { AlertTriangle, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';

interface PriorityBadgeProps {
  priority: TicketPriority;
  showIcon?: boolean;
  className?: string;
}

const priorityConfig: Record<TicketPriority, { bg: string; icon: React.ElementType }> = {
  critical: { bg: 'bg-[hsl(var(--priority-critical))] text-primary-foreground', icon: AlertTriangle },
  high: { bg: 'bg-[hsl(var(--priority-high))] text-primary-foreground', icon: ArrowUp },
  medium: { bg: 'bg-[hsl(var(--priority-medium))] text-primary', icon: ArrowRight },
  low: { bg: 'bg-[hsl(var(--priority-low))] text-primary-foreground', icon: ArrowDown },
};

export function PriorityBadge({ priority, showIcon = true, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-sm font-medium capitalize',
        config.bg,
        className
      )}
    >
      {showIcon && <Icon className="h-3.5 w-3.5" />}
      {priority}
    </span>
  );
}
