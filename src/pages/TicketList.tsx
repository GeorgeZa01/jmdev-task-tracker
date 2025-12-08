import { useState, useMemo } from 'react';
import { mockTickets } from '@/data/mockData';
import { Ticket, TicketStatus, TicketPriority, TicketLabel } from '@/types/ticket';
import { Header } from '@/components/layout/Header';
import { TicketFilters } from '@/components/tickets/TicketFilters';
import { TicketListItem } from '@/components/tickets/TicketListItem';
import { CreateTicketDialog } from '@/components/tickets/CreateTicketDialog';
import { Button } from '@/components/ui/button';
import { Plus, Ticket as TicketIcon } from 'lucide-react';

export default function TicketList() {
  const [tickets, setTickets] = useState<Ticket[]>(mockTickets);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [labelFilter, setLabelFilter] = useState<TicketLabel | 'all'>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // Search filter
      const matchesSearch =
        !searchQuery ||
        ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `#${ticket.ticketNumber}`.includes(searchQuery);

      // Status filter
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;

      // Priority filter
      const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;

      // Label filter
      const matchesLabel = labelFilter === 'all' || ticket.labels.includes(labelFilter);

      return matchesSearch && matchesStatus && matchesPriority && matchesLabel;
    });
  }, [tickets, searchQuery, statusFilter, priorityFilter, labelFilter]);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setLabelFilter('all');
  };

  const handleCreateTicket = (newTicket: Ticket) => {
    setTickets((prev) => [newTicket, ...prev]);
  };

  const nextTicketNumber = Math.max(...tickets.map((t) => t.ticketNumber), 0) + 1;

  const openCount = tickets.filter((t) => t.status === 'open').length;
  const closedCount = tickets.filter((t) => t.status === 'closed').length;

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
                {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || labelFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create your first ticket to get started'}
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
        />
      </main>
    </div>
  );
}
