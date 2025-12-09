-- Create tickets table
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number SERIAL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  labels TEXT[] DEFAULT '{}',
  author_id UUID,
  author_name TEXT NOT NULL,
  author_email TEXT,
  assignee_id UUID,
  assignee_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status_changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create comments table
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id UUID,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attachments table
CREATE TABLE public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create activity log table
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create public access policies (for now, public ticketing system)
CREATE POLICY "Public read access for tickets" ON public.tickets FOR SELECT USING (true);
CREATE POLICY "Public insert access for tickets" ON public.tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access for tickets" ON public.tickets FOR UPDATE USING (true);
CREATE POLICY "Public delete access for tickets" ON public.tickets FOR DELETE USING (true);

CREATE POLICY "Public read access for comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Public insert access for comments" ON public.comments FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read access for attachments" ON public.attachments FOR SELECT USING (true);
CREATE POLICY "Public insert access for attachments" ON public.attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete access for attachments" ON public.attachments FOR DELETE USING (true);

CREATE POLICY "Public read access for activity_logs" ON public.activity_logs FOR SELECT USING (true);
CREATE POLICY "Public insert access for activity_logs" ON public.activity_logs FOR INSERT WITH CHECK (true);

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-attachments', 'ticket-attachments', true);

-- Create storage policies
CREATE POLICY "Public read access for attachments bucket" ON storage.objects FOR SELECT USING (bucket_id = 'ticket-attachments');
CREATE POLICY "Public insert access for attachments bucket" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ticket-attachments');
CREATE POLICY "Public delete access for attachments bucket" ON storage.objects FOR DELETE USING (bucket_id = 'ticket-attachments');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for tickets
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;