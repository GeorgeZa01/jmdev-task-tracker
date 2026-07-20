
-- Private schema for helpers
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.get_user_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'agent' THEN 2 WHEN 'user' THEN 3 END LIMIT 1
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_user_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION private.get_user_role(uuid) TO authenticated, anon, service_role;

-- Drop the exposed public wrappers with CASCADE, then recreate all dependent policies against private.*
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;

-- tickets
CREATE POLICY "Users view own tickets, staff view all"
ON public.tickets FOR SELECT TO authenticated
USING (author_id = auth.uid() OR private.has_role(auth.uid(),'agent') OR private.has_role(auth.uid(),'admin'));

CREATE POLICY "Users update own, staff update all"
ON public.tickets FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR private.has_role(auth.uid(),'agent') OR private.has_role(auth.uid(),'admin'))
WITH CHECK (author_id = auth.uid() OR private.has_role(auth.uid(),'agent') OR private.has_role(auth.uid(),'admin'));

CREATE POLICY "Only admins can delete tickets"
ON public.tickets FOR DELETE TO authenticated
USING (private.has_role(auth.uid(),'admin'));

-- comments
CREATE POLICY "Users view comments on accessible tickets"
ON public.comments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = comments.ticket_id
  AND (t.author_id = auth.uid() OR private.has_role(auth.uid(),'agent') OR private.has_role(auth.uid(),'admin'))));

CREATE POLICY "Users can add comments as themselves"
ON public.comments FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = comments.ticket_id
  AND (t.author_id = auth.uid() OR private.has_role(auth.uid(),'agent') OR private.has_role(auth.uid(),'admin'))));

CREATE POLICY "Users update own comments, staff update all"
ON public.comments FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR private.has_role(auth.uid(),'agent') OR private.has_role(auth.uid(),'admin'))
WITH CHECK (author_id = auth.uid() OR private.has_role(auth.uid(),'agent') OR private.has_role(auth.uid(),'admin'));

CREATE POLICY "Users delete own comments, staff delete all"
ON public.comments FOR DELETE TO authenticated
USING (author_id = auth.uid() OR private.has_role(auth.uid(),'agent') OR private.has_role(auth.uid(),'admin'));

-- attachments (table)
CREATE POLICY "Users view attachments on accessible tickets"
ON public.attachments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = attachments.ticket_id
  AND (t.author_id = auth.uid() OR private.has_role(auth.uid(),'agent') OR private.has_role(auth.uid(),'admin'))));

CREATE POLICY "Users can add attachments on accessible tickets"
ON public.attachments FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = attachments.ticket_id
  AND (t.author_id = auth.uid() OR private.has_role(auth.uid(),'agent') OR private.has_role(auth.uid(),'admin'))));

CREATE POLICY "Ticket owners and admins can delete attachments"
ON public.attachments FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = attachments.ticket_id
  AND (t.author_id = auth.uid() OR private.has_role(auth.uid(),'admin'))));

-- storage.objects (ticket-attachments)
CREATE POLICY "Authenticated users can access ticket attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND auth.uid() IS NOT NULL AND (
    private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'agent')
    OR EXISTS (SELECT 1 FROM public.tickets t
               WHERE t.id::text = split_part(name,'/',1) AND t.author_id = auth.uid())
  )
);

CREATE POLICY "Ticket members upload attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments' AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id::text = split_part(name,'/',1)
      AND (t.author_id = auth.uid() OR private.has_role(auth.uid(),'agent') OR private.has_role(auth.uid(),'admin'))
  )
);

CREATE POLICY "Ticket members update attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id::text = split_part(name,'/',1)
      AND (t.author_id = auth.uid() OR private.has_role(auth.uid(),'agent') OR private.has_role(auth.uid(),'admin'))
  )
)
WITH CHECK (
  bucket_id = 'ticket-attachments' AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id::text = split_part(name,'/',1)
      AND (t.author_id = auth.uid() OR private.has_role(auth.uid(),'agent') OR private.has_role(auth.uid(),'admin'))
  )
);

CREATE POLICY "Users delete their own attachments; admins delete any"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'ticket-attachments' AND (
    private.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.tickets t
               WHERE t.id::text = split_part(name,'/',1) AND t.author_id = auth.uid())
  )
);
