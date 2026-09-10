import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTickets, useCreateTicket } from '@/hooks/useTickets';
import { useServiceTypes } from '@/hooks/useServiceTypes';
import { TicketStatus, TicketPriority, TicketLabel } from '@/types/ticket';
import { Header } from '@/components/layout/Header';
import { TicketFilters, SlaFilter } from '@/components/tickets/TicketFilters';
import { TicketListItem } from '@/components/tickets/TicketListItem';
import { CreateTicketDialog } from '@/components/tickets/CreateTicketDialog';
import { Button } from '@/components/ui/button';
import { Plus, Ticket as TicketIcon, Loader2 } from 'lucide-react';

export default function TicketList() {
  const { user } = useAuth();
  const { data: tickets = [], isLoading } = useTickets();
  const { data: serviceTypes = [] } = useServiceTypes();
  const createTicket = useCreateTicket();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [labelFilter, setLabelFilter] = useState<TicketLabel | 'all'>('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string | 'all'>('all');
  const [slaFilter, setSlaFilter] = useState<SlaFilter>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesSearch =
        !searchQuery ||
        ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.author.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `#${ticket.ticketNumber}`.includes(searchQuery);

      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
      const matchesLabel = labelFilter === 'all' || ticket.labels.includes(labelFilter);
      const matchesServiceType =
        serviceTypeFilter === 'all' || ticket.serviceType?.id === serviceTypeFilter;

      const matchesSla =
        slaFilter === 'all' ||
        (slaFilter === 'overdue'
          ? ticket.slaStatus === 'breached'
          : ticket.slaStatus === slaFilter);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesLabel &&
        matchesServiceType &&
        matchesSla
      );
    });
  }, [tickets, searchQuery, statusFilter, priorityFilter, labelFilter, serviceTypeFilter, slaFilter]);

  const hasFilters =
    !!searchQuery ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    labelFilter !== 'all' ||
    serviceTypeFilter !== 'all' ||
    slaFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setLabelFilter('all');
    setServiceTypeFilter('all');
    setSlaFilter('all');
  };

  const handleCreateTicket = async (data: {
    title: string;
    description: string;
    priority: TicketPriority;
    labels: TicketLabel[];
    serviceTypeId: string;
    assigneeId?: string;
    assigneeName?: string;
  }) => {
    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Unknown';

    await createTicket.mutateAsync({
      ...data,
      authorName: userName,
      authorEmail: user?.email,
      authorId: user?.id,
    });
  };

  const nextTicketNumber = Math.max(...tickets.map((t) => t.ticketNumber), 0) + 1;
  const openCount = tickets.filter((t) => t.status === 'open').length;
  const closedCount = tickets.filter((t) => t.status === 'closed').length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Tickets</h1>
            <p className="text-muted-foreground">
              {openCount} open · {closedCount} closed
            </p>
          </div>

          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </div>

        <div className="border-2 border-border bg-card">
          <TicketFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            priorityFilter={priorityFilter}
            onPriorityChange={setPriorityFilter}
            labelFilter={labelFilter}
            onLabelChange={setLabelFilter}
            serviceTypeFilter={serviceTypeFilter}
            onServiceTypeChange={setServiceTypeFilter}
            serviceTypes={serviceTypes}
            slaFilter={slaFilter}
            onSlaChange={setSlaFilter}
            onClearFilters={clearFilters}
          />

          {filteredTickets.length > 0 ? (
            <div>
              {filteredTickets.map((ticket) => (
                <TicketListItem key={ticket.id} ticket={ticket} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 bg-muted flex items-center justify-center mb-4">
                <TicketIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No tickets found</h3>
              <p className="text-muted-foreground mb-4">
                {hasFilters ? 'Try adjusting your filters' : 'Create your first ticket to get started'}
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Ticket
              </Button>
            </div>
          )}
        </div>

        <CreateTicketDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onCreateTicket={handleCreateTicket}
          nextTicketNumber={nextTicketNumber}
          isLoading={createTicket.isPending}
        />
      </main>
    </div>
  );
}
