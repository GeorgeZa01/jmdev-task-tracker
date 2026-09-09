ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

CREATE TABLE public.service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.service_types TO authenticated;
GRANT ALL ON public.service_types TO service_role;

ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service types are readable by all authenticated users" ON public.service_types
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.sla_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id uuid NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  response_hours integer NOT NULL CHECK (response_hours > 0),
  resolution_hours integer NOT NULL CHECK (resolution_hours > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (service_type_id, priority)
);

GRANT SELECT ON public.sla_rules TO authenticated;
GRANT ALL ON public.sla_rules TO service_role;

ALTER TABLE public.sla_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SLA rules are readable by all authenticated users" ON public.sla_rules
  FOR SELECT TO authenticated USING (true);

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id),
  ADD COLUMN IF NOT EXISTS response_due_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS resolution_due_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS first_responded_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.calculate_ticket_sla()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  rule public.sla_rules%ROWTYPE;
BEGIN
  IF NEW.service_type_id IS NOT NULL AND NEW.priority IS NOT NULL THEN
    SELECT * INTO rule
    FROM public.sla_rules
    WHERE service_type_id = NEW.service_type_id AND priority = NEW.priority
    LIMIT 1;

    IF FOUND THEN
      NEW.response_due_at := NEW.created_at + (rule.response_hours || ' hours')::interval;
      NEW.resolution_due_at := NEW.created_at + (rule.resolution_hours || ' hours')::interval;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calculate_ticket_sla_before_insert ON public.tickets;
CREATE TRIGGER calculate_ticket_sla_before_insert
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_ticket_sla();

DROP TRIGGER IF EXISTS calculate_ticket_sla_before_update ON public.tickets;
CREATE TRIGGER calculate_ticket_sla_before_update
  BEFORE UPDATE OF service_type_id, priority, created_at ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_ticket_sla();

CREATE TRIGGER update_sla_rules_updated_at
  BEFORE UPDATE ON public.sla_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
