DROP POLICY IF EXISTS "Authenticated users can create tickets" ON public.tickets;
CREATE POLICY "Users create tickets as themselves"
ON public.tickets
FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid());