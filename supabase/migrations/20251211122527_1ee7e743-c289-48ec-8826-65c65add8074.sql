-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'agent', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 1 
      WHEN 'agent' THEN 2 
      WHEN 'user' THEN 3 
    END
  LIMIT 1
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Auto-assign default role on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Update ticket RLS policies based on roles
DROP POLICY IF EXISTS "Public read access for tickets" ON public.tickets;
DROP POLICY IF EXISTS "Public insert access for tickets" ON public.tickets;
DROP POLICY IF EXISTS "Public update access for tickets" ON public.tickets;
DROP POLICY IF EXISTS "Public delete access for tickets" ON public.tickets;

-- New RLS policies for tickets
CREATE POLICY "Users view own tickets, staff view all"
ON public.tickets
FOR SELECT
USING (
  auth.uid() = author_id 
  OR public.has_role(auth.uid(), 'agent'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Authenticated users can create tickets"
ON public.tickets
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users update own, staff update all"
ON public.tickets
FOR UPDATE
USING (
  auth.uid() = author_id 
  OR public.has_role(auth.uid(), 'agent'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Only admins can delete tickets"
ON public.tickets
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Update comments RLS
DROP POLICY IF EXISTS "Public read access for comments" ON public.comments;
DROP POLICY IF EXISTS "Public insert access for comments" ON public.comments;

CREATE POLICY "Users view comments on accessible tickets"
ON public.comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id
    AND (
      t.author_id = auth.uid()
      OR public.has_role(auth.uid(), 'agent'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

CREATE POLICY "Authenticated users can add comments"
ON public.comments
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Update activity_logs RLS
DROP POLICY IF EXISTS "Public read access for activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Public insert access for activity_logs" ON public.activity_logs;

CREATE POLICY "Users view activity on accessible tickets"
ON public.activity_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id
    AND (
      t.author_id = auth.uid()
      OR public.has_role(auth.uid(), 'agent'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

CREATE POLICY "Authenticated users can add activity logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Update attachments RLS
DROP POLICY IF EXISTS "Public read access for attachments" ON public.attachments;
DROP POLICY IF EXISTS "Public insert access for attachments" ON public.attachments;
DROP POLICY IF EXISTS "Public delete access for attachments" ON public.attachments;

CREATE POLICY "Users view attachments on accessible tickets"
ON public.attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id
    AND (
      t.author_id = auth.uid()
      OR public.has_role(auth.uid(), 'agent'::app_role)
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

CREATE POLICY "Authenticated users can add attachments"
ON public.attachments
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Ticket owners and admins can delete attachments"
ON public.attachments
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id AND t.author_id = auth.uid()
  )
);