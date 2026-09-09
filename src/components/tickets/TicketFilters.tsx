import { TicketStatus, TicketPriority, TicketLabel, ServiceType } from '@/types/ticket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';

interface TicketFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: TicketStatus | 'all';
  onStatusChange: (status: TicketStatus | 'all') => void;
  priorityFilter: TicketPriority | 'all';
  onPriorityChange: (priority: TicketPriority | 'all') => void;
  labelFilter: TicketLabel | 'all';
  onLabelChange: (label: TicketLabel | 'all') => void;
  serviceTypeFilter?: string | 'all';
  onServiceTypeChange?: (serviceTypeId: string | 'all') => void;
  serviceTypes?: ServiceType[];
  slaFilter?: SlaFilter;
  onSlaChange?: (sla: SlaFilter) => void;
  onClearFilters: () => void;
}

export type SlaFilter = 'all' | 'on_track' | 'at_risk' | 'breached' | 'overdue';

export function TicketFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  priorityFilter,
  onPriorityChange,
  labelFilter,
  onLabelChange,
  serviceTypeFilter = 'all',
  onServiceTypeChange,
  serviceTypes = [],
  slaFilter = 'all',
  onSlaChange,
  onClearFilters,
}: TicketFiltersProps) {
  const hasActiveFilters =
    searchQuery ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    labelFilter !== 'all' ||
    serviceTypeFilter !== 'all' ||
    slaFilter !== 'all';

  return (
    <div className="space-y-4 p-4 border-b border-border bg-card">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={priorityFilter} onValueChange={onPriorityChange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={labelFilter} onValueChange={onLabelChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Label" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Labels</SelectItem>
              <SelectItem value="bug">Bug</SelectItem>
              <SelectItem value="feature">Feature</SelectItem>
              <SelectItem value="enhancement">Enhancement</SelectItem>
              <SelectItem value="documentation">Documentation</SelectItem>
              <SelectItem value="question">Question</SelectItem>
            </SelectContent>
          </Select>

          {onServiceTypeChange && (
            <Select value={serviceTypeFilter} onValueChange={onServiceTypeChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Service type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {serviceTypes.map((st) => (
                  <SelectItem key={st.id} value={st.id}>
                    {st.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {onSlaChange && (
            <Select value={slaFilter} onValueChange={(v) => onSlaChange(v as SlaFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="SLA status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All SLA</SelectItem>
                <SelectItem value="on_track">On track</SelectItem>
                <SelectItem value="at_risk">At risk</SelectItem>
                <SelectItem value="breached">Breached</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          )}
          
          {hasActiveFilters && (
            <Button variant="outline" size="icon" onClick={onClearFilters}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
