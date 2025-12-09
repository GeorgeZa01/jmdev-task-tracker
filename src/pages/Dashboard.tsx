import { useTicketStats } from '@/hooks/useTickets';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/tickets/StatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import {
  TicketCheck,
  CircleDot,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { data: stats, isLoading } = useTicketStats();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  const criticalTickets = stats?.tickets.filter(t => t.priority === 'critical' && t.status === 'open') || [];
  const highPriorityTickets = stats?.tickets.filter(t => t.priority === 'high' && t.status === 'open') || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of ticket activity</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <TicketCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.total || 0}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
              <CircleDot className="h-4 w-4 text-[hsl(var(--status-open))]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.open || 0}</div>
              <p className="text-xs text-muted-foreground">Awaiting resolution</p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Closed Tickets</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-closed))]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.closed || 0}</div>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-[hsl(var(--priority-critical))]" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.critical || 0}</div>
              <p className="text-xs text-muted-foreground">Needs immediate attention</p>
            </CardContent>
          </Card>
        </div>

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
                  key={ticket.assignee_id + ticket.priority}
                  to={`/tickets`}
                  className="block p-3 border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm text-muted-foreground">
                      {ticket.assignee_name || 'Unassigned'}
                    </span>
                    <StatusBadge status={ticket.status as 'open' | 'closed'} showIcon={false} className="flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={ticket.priority as 'critical' | 'high' | 'medium' | 'low'} />
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
      </main>
    </div>
  );
}
