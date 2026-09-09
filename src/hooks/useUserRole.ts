import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'agent' | 'user' | 'client';

export function useUserRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (error) {
        // If no role found, default to 'user'
        if (error.code === 'PGRST116') {
          return 'user' as AppRole;
        }
        throw error;
      }

      return data.role as AppRole;
    },
    enabled: !!user?.id,
  });
}

export function useIsAdmin() {
  const { data: role } = useUserRole();
  return role === 'admin';
}

export function useIsAgent() {
  const { data: role } = useUserRole();
  return role === 'agent' || role === 'admin';
}

export function useIsStaff() {
  const { data: role } = useUserRole();
  return role === 'admin' || role === 'agent';
}

export function useIsClient() {
  const { data: role } = useUserRole();
  return role === 'client';
}

export function useCanManageTicket(ticketAuthorId?: string) {
  const { user } = useAuth();
  const { data: role } = useUserRole();
  
  // Admins and agents can manage all tickets
  if (role === 'admin' || role === 'agent') return true;
  
  // Users and clients can only manage their own tickets
  return user?.id === ticketAuthorId;
}

/**
 * Can edit ticket title/description.
 * - Staff (admin, agent) can edit any ticket
 * - Authors can edit their own ticket's content
 */
export function useCanEditTicketContent(ticketAuthorId?: string) {
  const { user } = useAuth();
  const { data: role } = useUserRole();
  if (role === 'admin' || role === 'agent') return true;
  return !!user?.id && user.id === ticketAuthorId;
}

/**
 * Can change workflow fields: status (close/reopen), priority, labels, assignee, service type.
 * Restricted to staff (admin, agent).
 */
export function useCanManageTicketWorkflow() {
  const { data: role } = useUserRole();
  return role === 'admin' || role === 'agent';
}

/** Only admins can delete tickets. */
export function useCanDeleteTicket() {
  const { data: role } = useUserRole();
  return role === 'admin';
}

/**
 * Can post comments on this ticket.
 * Staff can comment anywhere; users and clients can comment on tickets they authored.
 */
export function useCanCommentOnTicket(ticketAuthorId?: string) {
  const { user } = useAuth();
  const { data: role } = useUserRole();
  if (role === 'admin' || role === 'agent') return true;
  return !!user?.id && user.id === ticketAuthorId;
}

/** Only admins can manage users (create/edit/deactivate/assign roles). */
export function useCanManageUsers() {
  const { data: role } = useUserRole();
  return role === 'admin';
}

/** Only admins and agents can view the team directory. */
export function useCanViewTeamDirectory() {
  const { data: role } = useUserRole();
  return role === 'admin' || role === 'agent' || role === 'user';
}

/** Only staff can access the dashboard. */
export function useCanViewDashboard() {
  const { data: role } = useUserRole();
  return role === 'admin' || role === 'agent';
}
