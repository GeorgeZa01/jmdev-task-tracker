import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { useAllProfiles } from '@/hooks/useProfiles';
import { useUsers } from '@/hooks/useUsers';
import { ProfileCard } from '@/components/profiles/ProfileCard';
import { Input } from '@/components/ui/input';
import { Loader2, Users, Search } from 'lucide-react';

export default function TeamDirectory() {
  const { data: profiles, isLoading: profilesLoading } = useAllProfiles();
  const { data: userRoles, isLoading: rolesLoading } = useUsers();
  const [search, setSearch] = useState('');

  const isLoading = profilesLoading || rolesLoading;

  // Create a map of user_id to role
  const roleMap = new Map(userRoles?.map((r) => [r.user_id, r.role]) || []);

  // Filter profiles by search
  const filteredProfiles = profiles?.filter((profile) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      profile.full_name?.toLowerCase().includes(searchLower) ||
      profile.department?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Team Directory
          </h1>
          <p className="text-muted-foreground">
            View team member profiles and contact information
          </p>
        </div>

        <div className="mb-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProfiles?.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                role={roleMap.get(profile.user_id)}
              />
            ))}
            {filteredProfiles?.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No team members found
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
