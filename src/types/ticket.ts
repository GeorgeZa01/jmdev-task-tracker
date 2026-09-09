export type TicketStatus = 'open' | 'closed';

export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';

export type TicketLabel = 'bug' | 'feature' | 'enhancement' | 'documentation' | 'question';

export type UserRole = 'admin' | 'agent' | 'user' | 'client';

export interface ServiceType {
  id: string;
  name: string;
  sortOrder: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
}

export interface Comment {
  id: string;
  ticketId: string;
  author: User;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityLog {
  id: string;
  ticketId: string;
  user: User;
  action: string;
  details?: string;
  createdAt: Date;
}

export type SlaStatus = 'on_track' | 'at_risk' | 'breached';

export interface Ticket {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  author: User;
  assignee?: User;
  status: TicketStatus;
  priority: TicketPriority;
  labels: TicketLabel[];
  serviceType?: ServiceType;
  responseDueAt?: Date;
  resolutionDueAt?: Date;
  firstRespondedAt?: Date;
  slaStatus?: SlaStatus;
  comments: Comment[];
  activityLog: ActivityLog[];
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
}
