-- 1) Input length constraints
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_title_length CHECK (char_length(title) BETWEEN 1 AND 200),
  ADD CONSTRAINT tickets_description_length CHECK (description IS NULL OR char_length(description) <= 10000);

ALTER TABLE public.comments
  ADD CONSTRAINT comments_content_length CHECK (char_length(content) BETWEEN 1 AND 5000);

ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_action_length CHECK (char_length(action) BETWEEN 1 AND 100);

-- 2) Prevent impersonation
DROP POLICY IF EXISTS "Authenticated users can add comments" ON public.comments;
CREATE POLICY "Users can add comments as themselves"
ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = comments.ticket_id
      AND (
        t.author_id = auth.uid()
        OR public.has_role(auth.uid(), 'agent'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

DROP POLICY IF EXISTS "Authenticated users can add activity logs" ON public.activity_logs;
CREATE POLICY "Users can add activity logs on accessible tickets"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = activity_logs.ticket_id
      AND (
        t.author_id = auth.uid()
        OR public.has_role(auth.uid(), 'agent'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

DROP POLICY IF EXISTS "Authenticated users can add attachments" ON public.attachments;
CREATE POLICY "Users can add attachments on accessible tickets"
ON public.attachments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = attachments.ticket_id
      AND (
        t.author_id = auth.uid()
        OR public.has_role(auth.uid(), 'agent'::app_role)
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- 3) Storage: replace public insert/delete policies with authenticated + ownership checks
DROP POLICY IF EXISTS "Public insert access for attachments bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public delete access for attachments bucket" ON storage.objects;

CREATE POLICY "Authenticated users upload attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users delete their own attachments; admins delete any"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.attachments a
      JOIN public.tickets t ON t.id = a.ticket_id
      WHERE a.file_path = storage.objects.name
        AND t.author_id = auth.uid()
    )
  )
);