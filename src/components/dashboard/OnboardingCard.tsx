import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useUsers, useCreateUser } from '@/hooks/useUsers';
import { Loader2, UserPlus, Users, ArrowRight, CheckCircle2 } from 'lucide-react';

export function OnboardingCard() {
  const { data: users } = useUsers();
  const createUser = useCreateUser();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'user' as 'admin' | 'agent' | 'user',
  });

  const totalUsers = users?.length ?? 0;
  const adminCount = users?.filter((u) => u.role === 'admin').length ?? 0;
  const agentCount = users?.filter((u) => u.role === 'agent').length ?? 0;
  const userCount = users?.filter((u) => u.role === 'user').length ?? 0;

  const canSubmit =
    formData.email.trim().length > 0 &&
    formData.password.length >= 8 &&
    formData.fullName.trim().length > 0 &&
    !createUser.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await createUser.mutateAsync(formData);
      setFormData({ email: '', password: '', fullName: '', role: 'user' });
    } catch {
      // toast handled in hook
    }
  };

  return (
    <Card className="border-2 mb-8">
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team onboarding
            </CardTitle>
            <CardDescription>
              Create initial users and assign roles. New members can sign in immediately.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{totalUsers} total</Badge>
            <Badge variant="default">{adminCount} admin</Badge>
            <Badge variant="secondary">{agentCount} agent</Badge>
            <Badge variant="outline">{userCount} user</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="onboard-name">Full name</Label>
            <Input
              id="onboard-name"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="Jane Doe"
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="onboard-email">Email</Label>
            <Input
              id="onboard-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="jane@jmdev.io"
              maxLength={255}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="onboard-password">Temp password</Label>
            <Input
              id="onboard-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="min 8 chars"
              minLength={8}
              maxLength={128}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="onboard-role">Role</Label>
            <Select
              value={formData.role}
              onValueChange={(value) =>
                setFormData({ ...formData, role: value as 'admin' | 'agent' | 'user' })
              }
            >
              <SelectTrigger id="onboard-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="agent">Support agent</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={!canSubmit} className="w-full">
            {createUser.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : createUser.isSuccess ? (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Add user
          </Button>
        </form>

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/users">
              Manage all users
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}