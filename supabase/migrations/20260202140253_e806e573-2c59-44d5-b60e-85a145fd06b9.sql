-- =============================================
-- FIX 1: Profile Privacy - Column-Level Security
-- =============================================

-- Create a view that hides sensitive fields (phone, bio) from other users
-- Users can see their own full profile, but only public info for others
CREATE OR REPLACE VIEW public.public_profiles 
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  full_name,
  avatar_url,
  department,
  CASE WHEN user_id = auth.uid() THEN phone ELSE NULL END as phone,
  CASE WHEN user_id = auth.uid() THEN bio ELSE NULL END as bio,
  created_at,
  updated_at
FROM public.profiles;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.public_profiles TO authenticated;

-- Update the base table policy to be more restrictive
-- Users can only directly access their own profile
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile directly"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- =============================================
-- FIX 2: Storage Bucket - Make Private
-- =============================================

-- Make the bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'ticket-attachments';

-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Public read access for attachments bucket" ON storage.objects;

-- Create a restrictive policy that respects ticket ownership
CREATE POLICY "Authenticated users can access ticket attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'ticket-attachments' AND
  auth.uid() IS NOT NULL AND
  (
    -- Admins and agents can access all attachments
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'agent'::app_role) OR
    -- Ticket authors can access attachments on their tickets
    EXISTS (
      SELECT 1 FROM public.attachments a
      JOIN public.tickets t ON a.ticket_id = t.id
      WHERE a.file_path = name
      AND t.author_id = auth.uid()
    )
  )
);