import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole, useCanManageTicket } from '@/hooks/useUserRole';
import { useTicket, useUpdateTicket, useAddComment } from '@/hooks/useTickets';
import { Header } from '@/components/layout/Header';
import { StatusBadge } from '@/components/tickets/StatusBadge';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { LabelBadge } from '@/components/tickets/LabelBadge';
import { CommentItem } from '@/components/tickets/CommentItem';
import { ActivityTimeline } from '@/components/tickets/ActivityTimeline';
import { FileAttachments } from '@/components/tickets/FileAttachments';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, MessageSquare, History, CheckCircle, RotateCcw, Pencil, X, Check, Loader2, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { TicketPriority, TicketLabel } from '@/types/ticket';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';

const ALL_LABELS: TicketLabel[] = ['bug', 'feature', 'enhancement', 'documentation', 'question'];

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: role } = useUserRole();
  
  const { data: ticket, isLoading } = useTicket(id || '');
  const updateTicket = useUpdateTicket();
  const addComment = useAddComment();
  
  const canManage = useCanManageTicket(ticket?.author.id);
  const isAdmin = role === 'admin';
  
  const [newComment, setNewComment] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const currentUserName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

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

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      await addComment.mutateAsync({
        ticketId: ticket.id,
        content: newComment.trim(),
        authorName: currentUserName,
        authorId: user?.id,
      });
      setNewComment('');
      toast({
        title: 'Comment added',
        description: 'Your comment has been posted.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add comment.',
        variant: 'destructive',
      });
    }
  };

  const toggleStatus = async () => {
    if (!canManage) return;
    
    const newStatus = ticket.status === 'open' ? 'closed' : 'open';
    
    try {
      await updateTicket.mutateAsync({
        id: ticket.id,
        updates: { 
          status: newStatus,
          status_changed_at: new Date().toISOString(),
        },
        actorName: currentUserName,
      });
      toast({
        title: `Ticket ${newStatus}`,
        description: `Ticket #${ticket.ticketNumber} has been ${newStatus === 'open' ? 'reopened' : 'closed'}.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update ticket status.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTicket = async () => {
    if (!isAdmin) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('tickets').delete().eq('id', ticket.id);
      if (error) throw error;
      
      toast({
        title: 'Ticket deleted',
        description: `Ticket #${ticket.ticketNumber} has been deleted.`,
      });
      navigate('/');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete ticket.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!editTitle.trim() || !canManage) return;
    
    try {
      await updateTicket.mutateAsync({
        id: ticket.id,
        updates: { title: editTitle.trim() },
        actorName: currentUserName,
      });
      setIsEditingTitle(false);
      toast({
        title: 'Title updated',
        description: 'The ticket title has been updated.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update title.',
        variant: 'destructive',
      });
    }
  };

  const handleCancelTitle = () => {
    setEditTitle(ticket.title);
    setIsEditingTitle(false);
  };

  const handleSaveDescription = async () => {
    if (!canManage) return;
    
    try {
      await updateTicket.mutateAsync({
        id: ticket.id,
        updates: { description: editDescription },
        actorName: currentUserName,
      });
      setIsEditingDescription(false);
      toast({
        title: 'Description updated',
        description: 'The ticket description has been updated.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update description.',
        variant: 'destructive',
      });
    }
  };

  const handleCancelDescription = () => {
    setEditDescription(ticket.description);
    setIsEditingDescription(false);
  };

  const handlePriorityChange = async (newPriority: TicketPriority) => {
    if (!canManage) return;
    
    try {
      await updateTicket.mutateAsync({
        id: ticket.id,
        updates: { priority: newPriority },
        actorName: currentUserName,
      });
      toast({
        title: 'Priority updated',
        description: `Priority changed to ${newPriority}.`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update priority.',
        variant: 'destructive',
      });
    }
  };

  const handleLabelToggle = async (label: TicketLabel) => {
    if (!canManage) return;
    
    const newLabels = ticket.labels.includes(label)
      ? ticket.labels.filter(l => l !== label)
      : [...ticket.labels, label];
    
    try {
      await updateTicket.mutateAsync({
        id: ticket.id,
        updates: { labels: newLabels },
        actorName: currentUserName,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update labels.',
        variant: 'destructive',
      });
    }
  };

  const startEditTitle = () => {
    if (!canManage) return;
    setEditTitle(ticket.title);
    setIsEditingTitle(true);
  };

  const startEditDescription = () => {
    if (!canManage) return;
    setEditDescription(ticket.description);
    setIsEditingDescription(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-6">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to tickets
          </Button>
          
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Ticket
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this ticket?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete ticket #{ticket.ticketNumber} 
                    and all associated comments, attachments, and activity logs.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteTicket} disabled={isDeleting}>
                    {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Header */}
            <div className="border-2 border-border bg-card p-6">
              <div className="flex items-start gap-4 mb-4">
                <StatusBadge status={ticket.status} />
                <span className="text-sm text-muted-foreground font-mono">
                  #{ticket.ticketNumber}
                </span>
              </div>
              
              {isEditingTitle ? (
                <div className="flex items-center gap-2 mb-4">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-xl font-bold"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" onClick={handleSaveTitle}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={handleCancelTitle}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-4 group">
                  <h1 className="text-2xl font-bold">{ticket.title}</h1>
                  {canManage && (
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={startEditTitle}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Avatar className="h-6 w-6">
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
              <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px]">
                      {getInitials(ticket.author.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-sm">{ticket.author.name}</span>
                  <span className="text-sm text-muted-foreground">
                    commented {formatDistanceToNow(ticket.createdAt, { addSuffix: true })}
                  </span>
                </div>
                {!isEditingDescription && canManage && (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={startEditDescription}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              
              <div className="p-4">
                {isEditingDescription ? (
                  <div className="space-y-3">
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={8}
                      className="font-sans text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={handleCancelDescription}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveDescription}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                      {ticket.description || 'No description provided.'}
                    </pre>
                  </div>
                )}
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
                  Comments ({ticket.comments.length})
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
                {ticket.comments.length > 0 ? (
                  ticket.comments.map((comment) => (
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
                      <AvatarFallback className="text-xs">
                        {getInitials(currentUserName)}
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
                        {canManage && (
                          <Button
                            variant="outline"
                            onClick={toggleStatus}
                            disabled={updateTicket.isPending}
                          >
                            {ticket.status === 'open' ? (
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
                        )}
                        <Button 
                          onClick={handleAddComment} 
                          disabled={!newComment.trim() || addComment.isPending}
                        >
                          {addComment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
            {/* Priority */}
            <div className="border-2 border-border bg-card p-4">
              <h3 className="font-semibold mb-3">Priority</h3>
              {canManage ? (
                <Select value={ticket.priority} onValueChange={(v) => handlePriorityChange(v as TicketPriority)}>
                  <SelectTrigger>
                    <SelectValue>
                      <PriorityBadge priority={ticket.priority} />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <PriorityBadge priority="low" />
                    </SelectItem>
                    <SelectItem value="medium">
                      <PriorityBadge priority="medium" />
                    </SelectItem>
                    <SelectItem value="high">
                      <PriorityBadge priority="high" />
                    </SelectItem>
                    <SelectItem value="critical">
                      <PriorityBadge priority="critical" />
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <PriorityBadge priority={ticket.priority} />
              )}
            </div>

            {/* Labels */}
            <div className="border-2 border-border bg-card p-4">
              <h3 className="font-semibold mb-3">Labels</h3>
              {canManage ? (
                <div className="space-y-2">
                  {ALL_LABELS.map((label) => (
                    <div key={label} className="flex items-center gap-2">
                      <Checkbox
                        id={`label-${label}`}
                        checked={ticket.labels.includes(label)}
                        onCheckedChange={() => handleLabelToggle(label)}
                      />
                      <label htmlFor={`label-${label}`} className="cursor-pointer">
                        <LabelBadge label={label} />
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {ticket.labels.length > 0 ? (
                    ticket.labels.map((label) => (
                      <LabelBadge key={label} label={label} />
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No labels</span>
                  )}
                </div>
              )}
            </div>

            {/* File Attachments */}
            <FileAttachments ticketId={ticket.id} />

            {/* Assignee */}
            <div className="border-2 border-border bg-card p-4">
              <h3 className="font-semibold mb-3">Assignee</h3>
              {ticket.assignee ? (
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px]">
                      {getInitials(ticket.assignee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{ticket.assignee.name}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No one assigned</p>
              )}
            </div>

            {/* Timestamps */}
            <div className="border-2 border-border bg-card p-4">
              <h3 className="font-semibold mb-3">Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatDistanceToNow(ticket.createdAt, { addSuffix: true })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span>{formatDistanceToNow(ticket.updatedAt, { addSuffix: true })}</span>
                </div>
                {ticket.closedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Closed</span>
                    <span>{formatDistanceToNow(ticket.closedAt, { addSuffix: true })}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
