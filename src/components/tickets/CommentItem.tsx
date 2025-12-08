import { Comment } from '@/types/ticket';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

interface CommentItemProps {
  comment: Comment;
}

export function CommentItem({ comment }: CommentItemProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={comment.author.avatar} alt={comment.author.name} />
        <AvatarFallback className="text-xs">
          {getInitials(comment.author.name)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="border border-border bg-card">
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border">
            <span className="font-semibold text-sm">{comment.author.name}</span>
            <span className="text-sm text-muted-foreground">
              commented {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
            </span>
          </div>
          
          <div className="p-4">
            <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
