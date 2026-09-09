import { SlaStatus } from '@/types/ticket';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, CheckCircle2, Timer } from 'lucide-react';

interface SlaBadgeProps {
  status?: SlaStatus;
  className?: string;
}

const config: Record<SlaStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
  on_track: { label: 'On track', variant: 'secondary', icon: CheckCircle2 },
  at_risk: { label: 'At risk', variant: 'default', icon: Timer },
  breached: { label: 'Breached', variant: 'destructive', icon: AlertTriangle },
};

export function SlaBadge({ status, className }: SlaBadgeProps) {
  if (!status) return null;

  const { label, variant, icon: Icon } = config[status];

  return (
    <Badge variant={variant} className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}

export function SlaDueDate({ dueAt, label }: { dueAt?: Date; label?: string }) {
  if (!dueAt) return null;

  const now = new Date();
  const isOverdue = now > dueAt;

  return (
    <span className={`text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
      {label && `${label}: `}
      {dueAt.toLocaleString('en-ZA', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })}
    </span>
  );
}
