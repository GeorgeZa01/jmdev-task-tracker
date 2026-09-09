import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ServiceType } from '@/types/ticket';

export function useServiceTypes() {
  return useQuery({
    queryKey: ['service-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      return (data || []).map((st): ServiceType => ({
        id: st.id,
        name: st.name,
        sortOrder: st.sort_order,
      }));
    },
    staleTime: 10 * 60 * 1000,
  });
}
