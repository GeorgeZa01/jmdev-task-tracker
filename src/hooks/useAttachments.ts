import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Attachment = Tables<'attachments'>;

export function useAttachments(ticketId: string) {
  return useQuery({
    queryKey: ['attachments', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Attachment[];
    },
    enabled: !!ticketId,
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ticketId,
      file,
      uploadedBy,
    }: {
      ticketId: string;
      file: File;
      uploadedBy: string;
    }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${ticketId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('ticket-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get signed URL (bucket is now private)
      const { data: urlData } = await supabase.storage
        .from('ticket-attachments')
        .createSignedUrl(fileName, 3600); // 1 hour expiry

      // Save attachment record
      const { data, error } = await supabase
        .from('attachments')
        .insert({
          ticket_id: ticketId,
          file_name: file.name,
          file_path: fileName,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: uploadedBy,
        })
        .select()
        .single();

      if (error) throw error;

      return { ...data, publicUrl: urlData?.signedUrl || '' };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', variables.ticketId] });
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, filePath, ticketId }: { id: string; filePath: string; ticketId: string }) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('ticket-attachments')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete record
      const { error } = await supabase
        .from('attachments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attachments', variables.ticketId] });
    },
  });
}

export async function getAttachmentUrl(filePath: string) {
  const { data, error } = await supabase.storage
    .from('ticket-attachments')
    .createSignedUrl(filePath, 3600); // 1 hour expiry
  
  if (error) throw error;
  return data.signedUrl;
}
