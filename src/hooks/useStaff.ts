import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsStaff } from '@/hooks/useUserRole';

export interface StaffMember {
  userId: string;
  name: string;
  role: 'admin' | 'agent';
}

/**
 * Team members (admins + agents) that a ticket can be assigned to.
 * Only staff can read all roles, so the query is disabled otherwise.
 */
export function useAssignableStaff() {
  const isStaff = useIsStaff();

  return useQuery({
    queryKey: ['assignable-staff'],
    enabled: isStaff,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<StaffMember[]> => {
      const [{ data: roles, error: rolesError }, { data: profiles, error: profilesError }] =
        await Promise.all([
          supabase.from('user_roles').select('user_id, role').in('role', ['admin', 'agent']),
          supabase.from('public_profiles').select('user_id, full_name'),
        ]);

      if (rolesError) throw rolesError;
      if (profilesError) throw profilesError;

      const nameByUser = new Map(
        (profiles || []).map((p: { user_id: string; full_name: string | null }) => [
          p.user_id,
          p.full_name,
        ])
      );

      const seen = new Set<string>();
      const staff: StaffMember[] = [];

      for (const r of roles || []) {
        if (seen.has(r.user_id)) continue;
        seen.add(r.user_id);
        staff.push({
          userId: r.user_id,
          name: nameByUser.get(r.user_id) || 'Team member',
          role: r.role as 'admin' | 'agent',
        });
      }

      return staff.sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}
