import { mockTickets, mockUsers } from '@/data/mockData';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/tickets/StatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import {
  TicketCheck,
  CircleDot,
  CheckCircle2,
  AlertTriangle,
  Users,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const openTickets = mockTickets.filter((t) => t.status === 'open');
  const closedTickets = mockTickets.filter((t) => t.status === 'closed');
  const criticalTickets = openTickets.filter((t) => t.priority === 'critical');
  const highPriorityTickets = openTickets.filter((t) => t.priority === 'high');

  const agentStats = mockUsers
    .filter((u) => u.role !== 'user')
    .map((user) => ({
      user,
      assigned: mockTickets.filter((t) => t.assignee?.id === user.id).length,
      open: mockTickets.filter((t) => t.assignee?.id === user.id && t.status === 'open').length,
      closed: mockTickets.filter((t) => t.assignee?.id === user.id && t.status === 'closed').length,
    }));

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of ticket activity and team performance</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <TicketCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{mockTickets.length}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
              <CircleDot className="h-4 w-4 text-[hsl(var(--status-open))]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{openTickets.length}</div>
              <p className="text-xs text-muted-foreground">Awaiting resolution</p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Closed Tickets</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-closed))]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{closedTickets.length}</div>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-[hsl(var(--priority-critical))]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{criticalTickets.length}</div>
              <p className="text-xs text-muted-foreground">Needs immediate attention</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team Performance */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {agentStats.map((stat) => (
                  <div
                    key={stat.user.id}
                    className="flex items-center justify-between p-3 border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={stat.user.avatar} alt={stat.user.name} />
                        <AvatarFallback>{getInitials(stat.user.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{stat.user.name}</p>
                        <p className="text-sm text-muted-foreground capitalize">{stat.user.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <p className="font-bold">{stat.assigned}</p>
                        <p className="text-muted-foreground">Assigned</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-[hsl(var(--status-open))]">{stat.open}</p>
                        <p className="text-muted-foreground">Open</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-[hsl(var(--status-closed))]">{stat.closed}</p>
                        <p className="text-muted-foreground">Closed</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Priority Tickets */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                High Priority Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...criticalTickets, ...highPriorityTickets].slice(0, 5).map((ticket) => (
                  <Link
                    key={ticket.id}
                    to={`/tickets/${ticket.id}`}
                    className="block p-3 border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-medium line-clamp-1">{ticket.title}</h4>
                      <StatusBadge status={ticket.status} showIcon={false} className="flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={ticket.priority} />
                      <span className="text-sm text-muted-foreground">
                        #{ticket.ticketNumber}
                      </span>
                    </div>
                  </Link>
                ))}
                
                {criticalTickets.length === 0 && highPriorityTickets.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No high priority tickets
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
