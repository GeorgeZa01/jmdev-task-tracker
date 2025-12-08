import { ActivityLog } from '@/types/ticket';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { 
  Plus, 
  UserPlus, 
  Tag, 
  CheckCircle, 
  RotateCcw,
  Edit,
  Trash2
} from 'lucide-react';

interface ActivityTimelineProps {
  activities: ActivityLog[];
}

const actionIcons: Record<string, React.ElementType> = {
  created: Plus,
  assigned: UserPlus,
  labeled: Tag,
  closed: CheckCircle,
  reopened: RotateCcw,
  edited: Edit,
  deleted: Trash2,
};

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="space-y-4">
      {activities.map((activity, index) => {
        const Icon = actionIcons[activity.action] || Plus;
        
        return (
          <div key={activity.id} className="flex items-start gap-3">
            <div className="relative">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              {index < activities.length - 1 && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 w-px h-6 bg-border" />
              )}
            </div>
            
            <div className="flex-1 min-w-0 py-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={activity.user.avatar} alt={activity.user.name} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(activity.user.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm">{activity.user.name}</span>
                <span className="text-sm text-muted-foreground">
                  {activity.action}
                  {activity.details && ` · ${activity.details}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(activity.createdAt, { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
