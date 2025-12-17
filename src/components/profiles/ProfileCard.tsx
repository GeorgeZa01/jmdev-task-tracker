import { Profile } from '@/hooks/useProfiles';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Phone, Mail, Building, User } from 'lucide-react';

interface ProfileCardProps {
  profile: Profile;
  email?: string;
  role?: 'admin' | 'agent' | 'user';
}

export function ProfileCard({ profile, email, role }: ProfileCardProps) {
  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 border-2 border-border">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-lg">
              {getInitials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">
              {profile.full_name || 'Unnamed User'}
            </h3>
            {role && (
              <Badge
                variant={role === 'admin' ? 'default' : role === 'agent' ? 'secondary' : 'outline'}
                className="mt-1"
              >
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {profile.bio && (
          <p className="text-sm text-muted-foreground">{profile.bio}</p>
        )}
        
        <div className="space-y-2 text-sm">
          {email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <a href={`mailto:${email}`} className="truncate hover:underline">
                {email}
              </a>
            </div>
          )}
          
          {profile.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 flex-shrink-0" />
              <a href={`tel:${profile.phone}`} className="hover:underline">
                {profile.phone}
              </a>
            </div>
          )}
          
          {profile.department && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building className="h-4 w-4 flex-shrink-0" />
              <span>{profile.department}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
