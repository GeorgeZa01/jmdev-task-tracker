-- Add UPDATE policy: Users can update their own comments, staff can update all
CREATE POLICY "Users update own comments, staff update all"
ON public.comments
FOR UPDATE
USING (
  (auth.uid() = author_id) OR 
  has_role(auth.uid(), 'agent'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (auth.uid() = author_id) OR 
  has_role(auth.uid(), 'agent'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add DELETE policy: Users can delete their own comments, staff can delete all
CREATE POLICY "Users delete own comments, staff delete all"
ON public.comments
FOR DELETE
USING (
  (auth.uid() = author_id) OR 
  has_role(auth.uid(), 'agent'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role)
);