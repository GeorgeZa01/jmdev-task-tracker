import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AppRole = 'admin' | 'agent' | 'user';

export interface ManagedUser {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  createdAt: string;
  lastSignInAt: string | null;
  deactivated: boolean;
}

// Back-compat shape used elsewhere (e.g. OnboardingCard counts).
export interface UserWithRole {
  user_id: string;
  role: AppRole;
  created_at: string;
}

async function invokeManageUsers<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('manage-users', { body });
  if (error) throw new Error(error.message || 'Request failed');
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function useUsers() {
  return useQuery({
    queryKey: ['managed-users'],
    queryFn: async () => {
      const { users } = await invokeManageUsers<{ users: ManagedUser[] }>({ action: 'list' });
      // Keep back-compat consumers happy by also exposing user_id/created_at fields.
      return users.map((u) => ({
        ...u,
        user_id: u.id,
        created_at: u.createdAt,
      }));
    },
  });
}

interface CreateUserData {
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateUserData) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('create-user', {
        body: data,
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create user');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-users'] });
      toast.success('User created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create user');
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      await invokeManageUsers({ action: 'update', userId, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-users'] });
      toast.success('User role updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update user role');
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      role,
      fullName,
    }: {
      userId: string;
      role?: AppRole;
      fullName?: string;
    }) => {
      await invokeManageUsers({ action: 'update', userId, role, fullName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managed-users'] });
      toast.success('User updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update user');
    },
  });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      await invokeManageUsers({
        action: active ? 'reactivate' : 'deactivate',
        userId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['managed-users'] });
      toast.success(variables.active ? 'User reactivated' : 'User deactivated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update user status');
    },
  });
}
