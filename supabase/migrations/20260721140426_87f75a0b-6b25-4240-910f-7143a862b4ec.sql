
-- activity_logs: allow reads for anyone who can see the ticket; allow inserts by authenticated users who can access the ticket
CREATE POLICY "View activity for accessible tickets"
ON public.activity_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = activity_logs.ticket_id
      AND (
        t.author_id = auth.uid()
        OR private.has_role(auth.uid(), 'admin')
        OR private.has_role(auth.uid(), 'agent')
      )
  )
);

CREATE POLICY "Insert activity for accessible tickets"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = activity_logs.ticket_id
      AND (
        t.author_id = auth.uid()
        OR private.has_role(auth.uid(), 'admin')
        OR private.has_role(auth.uid(), 'agent')
      )
  )
);

-- user_roles: only admins may insert/update/delete
CREATE POLICY "Admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'))
WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'));
