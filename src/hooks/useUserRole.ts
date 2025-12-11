import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type AppRole = 'admin' | 'agent' | 'user';

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

export function useCanManageTicket(ticketAuthorId?: string) {
  const { user } = useAuth();
  const { data: role } = useUserRole();
  
  // Admins and agents can manage all tickets
  if (role === 'admin' || role === 'agent') return true;
  
  // Users can only manage their own tickets
  return user?.id === ticketAuthorId;
}
