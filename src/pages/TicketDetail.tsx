import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { mockTickets, mockUsers, currentUser } from '@/data/mockData';
import { Header } from '@/components/layout/Header';
import { StatusBadge } from '@/components/tickets/StatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { LabelBadge } from '@/components/tickets/LabelBadge';
import { CommentItem } from '@/components/tickets/CommentItem';
import { ActivityTimeline } from '@/components/tickets/ActivityTimeline';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, MessageSquare, History, CheckCircle, RotateCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const ticket = mockTickets.find((t) => t.id === id);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState(ticket?.comments || []);
  const [status, setStatus] = useState(ticket?.status || 'open');
  const [assigneeId, setAssigneeId] = useState(ticket?.assignee?.id || '');

  if (!ticket) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-6">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold mb-2">Ticket not found</h1>
            <p className="text-muted-foreground mb-4">
              The ticket you're looking for doesn't exist.
            </p>
            <Link to="/">
              <Button>Go back to tickets</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const comment = {
      id: crypto.randomUUID(),
      ticketId: ticket.id,
      author: currentUser,
      content: newComment.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setComments((prev) => [...prev, comment]);
    setNewComment('');

    toast({
      title: 'Comment added',
      description: 'Your comment has been posted.',
    });
  };

  const toggleStatus = () => {
    const newStatus = status === 'open' ? 'closed' : 'open';
    setStatus(newStatus);

    toast({
      title: `Ticket ${newStatus}`,
      description: `Ticket #${ticket.ticketNumber} has been ${newStatus === 'open' ? 'reopened' : 'closed'}.`,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-6">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to tickets
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Header */}
            <div className="border-2 border-border bg-card p-6">
              <div className="flex items-start gap-4 mb-4">
                <StatusBadge status={status} />
                <span className="text-sm text-muted-foreground font-mono">
                  #{ticket.ticketNumber}
                </span>
              </div>
              
              <h1 className="text-2xl font-bold mb-4">{ticket.title}</h1>
              
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={ticket.author.avatar} alt={ticket.author.name} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(ticket.author.name)}
                  </AvatarFallback>
                </Avatar>
                <span>
                  <strong className="text-foreground">{ticket.author.name}</strong> opened this ticket{' '}
                  {formatDistanceToNow(ticket.createdAt, { addSuffix: true })}
                </span>
              </div>
            </div>

            {/* Ticket Description */}
            <div className="border-2 border-border bg-card">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={ticket.author.avatar} alt={ticket.author.name} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(ticket.author.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold text-sm">{ticket.author.name}</span>
                <span className="text-sm text-muted-foreground">
                  commented {formatDistanceToNow(ticket.createdAt, { addSuffix: true })}
                </span>
              </div>
              
              <div className="p-4">
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {ticket.description}
                  </pre>
                </div>
              </div>
            </div>

            {/* Comments and Activity */}
            <Tabs defaultValue="comments" className="border-2 border-border bg-card">
              <TabsList className="w-full justify-start border-b border-border bg-muted/50 p-0 h-auto">
                <TabsTrigger
                  value="comments"
                  className="data-[state=active]:bg-card data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Comments ({comments.length})
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="data-[state=active]:bg-card data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-3"
                >
                  <History className="h-4 w-4 mr-2" />
                  Activity ({ticket.activityLog.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="comments" className="p-4 space-y-4">
                {comments.length > 0 ? (
                  comments.map((comment) => (
                    <CommentItem key={comment.id} comment={comment} />
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No comments yet. Be the first to comment!
                  </p>
                )}
                
                {/* Add Comment */}
                <div className="pt-4 border-t border-border">
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                      <AvatarFallback className="text-xs">
                        {getInitials(currentUser.name)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 space-y-3">
                      <Textarea
                        placeholder="Leave a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={4}
                      />
                      
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={toggleStatus}
                        >
                          {status === 'open' ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Close ticket
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Reopen ticket
                            </>
                          )}
                        </Button>
                        <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                          Comment
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="activity" className="p-4">
                <ActivityTimeline activities={ticket.activityLog} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Assignee */}
            <div className="border-2 border-border bg-card p-4">
              <h3 className="font-semibold mb-3">Assignee</h3>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {mockUsers
                    .filter((u) => u.role !== 'user')
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          {user.name}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="border-2 border-border bg-card p-4">
              <h3 className="font-semibold mb-3">Priority</h3>
              <PriorityBadge priority={ticket.priority} />
            </div>

            {/* Labels */}
            <div className="border-2 border-border bg-card p-4">
              <h3 className="font-semibold mb-3">Labels</h3>
              {ticket.labels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {ticket.labels.map((label) => (
                    <LabelBadge key={label} label={label} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No labels</p>
              )}
            </div>

            {/* Participants */}
            <div className="border-2 border-border bg-card p-4">
              <h3 className="font-semibold mb-3">Participants</h3>
              <div className="flex flex-wrap gap-2">
                {[ticket.author, ...(ticket.assignee ? [ticket.assignee] : [])]
                  .filter((v, i, a) => a.findIndex((t) => t.id === v.id) === i)
                  .map((user) => (
                    <Avatar key={user.id} className="h-8 w-8">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="text-xs">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
