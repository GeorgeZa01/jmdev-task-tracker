CREATE OR REPLACE FUNCTION public.list_assignable_staff()
RETURNS TABLE (user_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id, COALESCE(p.full_name, 'Team member') AS full_name
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role IN ('admin'::app_role, 'agent'::app_role)
    AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'agent'::app_role))
  ORDER BY 2;
$$;

REVOKE ALL ON FUNCTION public.list_assignable_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_assignable_staff() TO authenticated;