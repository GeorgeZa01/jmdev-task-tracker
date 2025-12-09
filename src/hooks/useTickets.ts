import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Ticket, TicketStatus, TicketPriority, TicketLabel } from '@/types/ticket';
import { Tables, TablesInsert } from '@/integrations/supabase/types';

type DbTicket = Tables<'tickets'>;
type DbComment = Tables<'comments'>;
type DbActivityLog = Tables<'activity_logs'>;

// Transform database ticket to app Ticket type
const transformTicket = (
  dbTicket: DbTicket,
  comments: DbComment[] = [],
  activities: DbActivityLog[] = []
): Ticket => {
  return {
    id: dbTicket.id,
    ticketNumber: dbTicket.ticket_number,
    title: dbTicket.title,
    description: dbTicket.description || '',
    author: {
      id: dbTicket.author_id || 'unknown',
      name: dbTicket.author_name,
      email: dbTicket.author_email || '',
      role: 'user',
    },
    assignee: dbTicket.assignee_id ? {
      id: dbTicket.assignee_id,
      name: dbTicket.assignee_name || 'Unknown',
      email: '',
      role: 'agent',
    } : undefined,
    status: dbTicket.status as TicketStatus,
    priority: dbTicket.priority as TicketPriority,
    labels: (dbTicket.labels || []) as TicketLabel[],
    comments: comments.map(c => ({
      id: c.id,
      ticketId: c.ticket_id,
      author: {
        id: c.author_id || 'unknown',
        name: c.author_name,
        email: '',
        role: 'user' as const,
      },
      content: c.content,
      createdAt: new Date(c.created_at),
      updatedAt: new Date(c.created_at),
    })),
    activityLog: activities.map(a => ({
      id: a.id,
      ticketId: a.ticket_id,
      user: {
        id: 'system',
        name: a.actor_name,
        email: '',
        role: 'agent' as const,
      },
      action: a.action,
      details: typeof a.details === 'string' ? a.details : JSON.stringify(a.details),
      createdAt: new Date(a.created_at),
    })),
    createdAt: new Date(dbTicket.created_at),
    updatedAt: new Date(dbTicket.updated_at),
    closedAt: dbTicket.status === 'closed' ? new Date(dbTicket.status_changed_at) : undefined,
  };
};

export function useTickets() {
  return useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return tickets.map(t => transformTicket(t));
    },
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const [ticketResult, commentsResult, activitiesResult] = await Promise.all([
        supabase.from('tickets').select('*').eq('id', id).single(),
        supabase.from('comments').select('*').eq('ticket_id', id).order('created_at'),
        supabase.from('activity_logs').select('*').eq('ticket_id', id).order('created_at'),
      ]);

      if (ticketResult.error) throw ticketResult.error;
      
      return transformTicket(
        ticketResult.data,
        commentsResult.data || [],
        activitiesResult.data || []
      );
    },
    enabled: !!id,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      priority: TicketPriority;
      labels: TicketLabel[];
      authorName: string;
      authorEmail?: string;
      assigneeId?: string;
      assigneeName?: string;
    }) => {
      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert({
          title: data.title,
          description: data.description,
          priority: data.priority,
          labels: data.labels,
          author_name: data.authorName,
          author_email: data.authorEmail,
          assignee_id: data.assigneeId,
          assignee_name: data.assigneeName,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        ticket_id: ticket.id,
        actor_name: data.authorName,
        action: 'created',
      });

      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
      actorName,
    }: {
      id: string;
      updates: Partial<TablesInsert<'tickets'>>;
      actorName: string;
    }) => {
      const { data: ticket, error } = await supabase
        .from('tickets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log activity for status changes
      if (updates.status) {
        await supabase.from('activity_logs').insert({
          ticket_id: id,
          actor_name: actorName,
          action: updates.status === 'closed' ? 'closed' : 'reopened',
        });
      }

      return ticket;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', variables.id] });
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ticketId,
      content,
      authorName,
      authorId,
    }: {
      ticketId: string;
      content: string;
      authorName: string;
      authorId?: string;
    }) => {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          ticket_id: ticketId,
          content,
          author_name: authorName,
          author_id: authorId,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        ticket_id: ticketId,
        actor_name: authorName,
        action: 'commented',
      });

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ticket', variables.ticketId] });
    },
  });
}

export function useTicketStats() {
  return useQuery({
    queryKey: ['ticket-stats'],
    queryFn: async () => {
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('status, priority, assignee_id, assignee_name');

      if (error) throw error;

      const total = tickets.length;
      const open = tickets.filter(t => t.status === 'open').length;
      const closed = tickets.filter(t => t.status === 'closed').length;
      const critical = tickets.filter(t => t.priority === 'critical' && t.status === 'open').length;
      const high = tickets.filter(t => t.priority === 'high' && t.status === 'open').length;

      return { total, open, closed, critical, high, tickets };
    },
  });
}
