DROP FUNCTION IF EXISTS public.list_assignable_staff();

CREATE POLICY "Staff can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'agent'::app_role));