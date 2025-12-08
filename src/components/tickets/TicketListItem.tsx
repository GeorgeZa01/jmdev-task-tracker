import { Link } from 'react-router-dom';
import { Ticket } from '@/types/ticket';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { LabelBadge } from './LabelBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TicketListItemProps {
  ticket: Ticket;
}

export function TicketListItem({ ticket }: TicketListItemProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <Link
      to={`/tickets/${ticket.id}`}
      className="block border-b border-border hover:bg-muted/50 transition-colors"
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={ticket.status} />
              <span className="text-sm text-muted-foreground font-mono">
                #{ticket.ticketNumber}
              </span>
            </div>
            
            <h3 className="text-base font-semibold text-foreground mb-2 line-clamp-1">
              {ticket.title}
            </h3>
            
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <PriorityBadge priority={ticket.priority} />
              {ticket.labels.map((label) => (
                <LabelBadge key={label} label={label} />
              ))}
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={ticket.author.avatar} alt={ticket.author.name} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(ticket.author.name)}
                  </AvatarFallback>
                </Avatar>
                <span>{ticket.author.name}</span>
              </div>
              
              <span>
                opened {formatDistanceToNow(ticket.createdAt, { addSuffix: true })}
              </span>
              
              {ticket.comments.length > 0 && (
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  <span>{ticket.comments.length}</span>
                </div>
              )}
            </div>
          </div>
          
          {ticket.assignee && (
            <div className="flex-shrink-0">
              <Avatar className="h-8 w-8 border-2 border-background shadow-sm">
                <AvatarImage src={ticket.assignee.avatar} alt={ticket.assignee.name} />
                <AvatarFallback className="text-xs">
                  {getInitials(ticket.assignee.name)}
                </AvatarFallback>
              </Avatar>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
