import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Ticket, TicketStatus, TicketPriority, TicketLabel, ServiceType, SlaStatus } from '@/types/ticket';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { z } from 'zod';

// Input validation schemas — enforce length and shape before hitting the DB.
const ticketInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be 200 characters or fewer'),
  description: z.string().trim().max(10000, 'Description must be 10,000 characters or fewer').optional().default(''),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  serviceTypeId: z.string().uuid('Service type is required'),
});

const commentInputSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(5000, 'Comment must be 5,000 characters or fewer'),
});

const ticketUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(10000).optional(),
  serviceTypeId: z.string().uuid().optional(),
});

type DbTicket = Tables<'tickets'>;
type DbComment = Tables<'comments'>;
type DbActivityLog = Tables<'activity_logs'>;
type DbServiceType = Tables<'service_types'>;

function computeSlaStatus(
  status: TicketStatus,
  responseDueAt?: Date,
  resolutionDueAt?: Date,
  firstRespondedAt?: Date
): SlaStatus | undefined {
  if (status === 'closed' || !responseDueAt || !resolutionDueAt) return undefined;

  const now = new Date();

  if (firstRespondedAt) {
    // After first response, track resolution deadline.
    if (now > resolutionDueAt) return 'breached';
    const resolutionWarning = new Date(resolutionDueAt.getTime() - 60 * 60 * 1000); // 1 hour buffer
    if (now > resolutionWarning) return 'at_risk';
    return 'on_track';
  }

  // Before first response, track response deadline.
  if (now > responseDueAt) return 'breached';
  const responseWarning = new Date(responseDueAt.getTime() - 30 * 60 * 1000); // 30 min buffer
  if (now > responseWarning) return 'at_risk';
  return 'on_track';
}

// Transform database ticket to app Ticket type
const transformTicket = (
  dbTicket: DbTicket,
  serviceTypes: Map<string, DbServiceType>,
  comments: DbComment[] = [],
  activities: DbActivityLog[] = []
): Ticket => {
  const serviceType = dbTicket.service_type_id
    ? serviceTypes.get(dbTicket.service_type_id)
    : undefined;

  const responseDueAt = dbTicket.response_due_at ? new Date(dbTicket.response_due_at) : undefined;
  const resolutionDueAt = dbTicket.resolution_due_at ? new Date(dbTicket.resolution_due_at) : undefined;
  const firstRespondedAt = dbTicket.first_responded_at ? new Date(dbTicket.first_responded_at) : undefined;

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
    serviceType: serviceType ? {
      id: serviceType.id,
      name: serviceType.name,
      sortOrder: serviceType.sort_order,
    } : undefined,
    responseDueAt,
    resolutionDueAt,
    firstRespondedAt,
    slaStatus: computeSlaStatus(
      dbTicket.status as TicketStatus,
      responseDueAt,
      resolutionDueAt,
      firstRespondedAt
    ),
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
  const queryClient = useQueryClient();

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('tickets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tickets'] });
          queryClient.invalidateQueries({ queryKey: ['ticket-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const [{ data: tickets, error: ticketsError }, { data: serviceTypes, error: stError }] = await Promise.all([
        supabase.from('tickets').select('*').order('created_at', { ascending: false }),
        supabase.from('service_types').select('*').order('sort_order', { ascending: true }),
      ]);

      if (ticketsError) throw ticketsError;
      if (stError) throw stError;

      const serviceTypeMap = new Map((serviceTypes || []).map((st) => [st.id, st]));
      return (tickets || []).map(t => transformTicket(t, serviceTypeMap));
    },
  });
}

export function useTicket(id: string) {
  const queryClient = useQueryClient();

  // Set up real-time subscription for single ticket
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`ticket-${id}-realtime`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ticket', id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `ticket_id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['ticket', id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  return useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const [ticketResult, commentsResult, activitiesResult, serviceTypesResult] = await Promise.all([
        supabase.from('tickets').select('*').eq('id', id).single(),
        supabase.from('comments').select('*').eq('ticket_id', id).order('created_at'),
        supabase.from('activity_logs').select('*').eq('ticket_id', id).order('created_at'),
        supabase.from('service_types').select('*'),
      ]);

      if (ticketResult.error) throw ticketResult.error;
      if (serviceTypesResult.error) throw serviceTypesResult.error;

      const serviceTypeMap = new Map((serviceTypesResult.data || []).map((st) => [st.id, st]));
      return transformTicket(
        ticketResult.data,
        serviceTypeMap,
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
      serviceTypeId: string;
      authorName: string;
      authorEmail?: string;
      authorId?: string;
      assigneeId?: string;
      assigneeName?: string;
    }) => {
      // Validate user-supplied fields before persisting
      ticketInputSchema.parse({
        title: data.title,
        description: data.description,
        priority: data.priority,
        serviceTypeId: data.serviceTypeId,
      });

      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert({
          title: data.title.trim(),
          description: data.description?.trim() ?? '',
          priority: data.priority,
          labels: data.labels,
          service_type_id: data.serviceTypeId,
          author_name: data.authorName,
          author_email: data.authorEmail,
          author_id: data.authorId,
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
      // Validate mutable user-supplied fields
      if (updates.title !== undefined || updates.description !== undefined || updates.service_type_id !== undefined) {
        ticketUpdateSchema.parse({
          title: updates.title ?? undefined,
          description: updates.description ?? undefined,
          serviceTypeId: updates.service_type_id ?? undefined,
        });
      }

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
      isStaff,
    }: {
      ticketId: string;
      content: string;
      authorName: string;
      authorId?: string;
      isStaff?: boolean;
    }) => {
      commentInputSchema.parse({ content });

      const { data, error } = await supabase
        .from('comments')
        .insert({
          ticket_id: ticketId,
          content: content.trim(),
          author_name: authorName,
          author_id: authorId,
        })
        .select()
        .single();

      if (error) throw error;

      // Mark first response time when staff replies for the first time.
      if (isStaff) {
        await supabase
          .from('tickets')
          .update({ first_responded_at: new Date().toISOString() })
          .eq('id', ticketId)
          .is('first_responded_at', null);
      }

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
        .select('status, priority, assignee_id, assignee_name, service_type_id, response_due_at, resolution_due_at, first_responded_at, created_at');

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
