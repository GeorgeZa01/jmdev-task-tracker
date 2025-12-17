import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useMyProfile, useUpdateProfile } from '@/hooks/useProfiles';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Settings as SettingsIcon, User, Shield, UserCog, KeyRound, Phone, Building } from 'lucide-react';

const roleConfig = {
  admin: { label: 'Admin', variant: 'default' as const, icon: Shield },
  agent: { label: 'Agent', variant: 'secondary' as const, icon: UserCog },
  user: { label: 'User', variant: 'outline' as const, icon: User },
};

export default function Settings() {
  const { user } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const updateProfile = useUpdateProfile();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [bio, setBio] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setDepartment(profile.department || '');
      setBio(profile.bio || '');
    }
  }, [profile]);

  const handleUpdateProfile = async () => {
    await updateProfile.mutateAsync({
      full_name: fullName,
      phone,
      department,
      bio,
    });

    // Also update auth metadata
    await supabase.auth.updateUser({
      data: { full_name: fullName },
    });
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast.error('Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const currentRole = role || 'user';
  const roleInfo = roleConfig[currentRole];

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your account settings
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile
              </CardTitle>
              <CardDescription>
                Your personal information visible to other team members
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department" className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Department
                  </Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Engineering, Sales, etc."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A short bio about yourself..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <div>
                  {roleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Badge variant={roleInfo.variant}>
                      <roleInfo.icon className="h-3 w-3 mr-1" />
                      {roleInfo.label}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Contact an admin to change your role
                </p>
              </div>

              <Button
                onClick={handleUpdateProfile}
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Profile
              </Button>
            </CardContent>
          </Card>

          {/* Password Section */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <Button
                onClick={handleUpdatePassword}
                disabled={isUpdatingPassword || !newPassword || newPassword !== confirmPassword}
              >
                {isUpdatingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update Password
              </Button>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>User ID</span>
                <span className="font-mono">{user?.id?.slice(0, 8)}...</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span>Created</span>
                <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span>Last Sign In</span>
                <span>{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : '-'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
