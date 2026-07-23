import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useSetUserActive,
  type ManagedUser,
  type AppRole,
} from '@/hooks/useUsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  UserPlus,
  Shield,
  UserCog,
  User,
  Pencil,
  UserX,
  UserCheck,
  Search,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const roleConfig: Record<AppRole, { label: string; variant: 'default' | 'secondary' | 'outline'; icon: typeof Shield }> = {
  admin: { label: 'Admin', variant: 'default', icon: Shield },
  agent: { label: 'Support agent', variant: 'secondary', icon: UserCog },
  user: { label: 'User', variant: 'outline', icon: User },
};

type RoleFilter = AppRole | 'all';
type StatusFilter = 'all' | 'active' | 'deactivated';

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const { data: users, isLoading: usersLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const setActive = useSetUserActive();

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'user' as AppRole,
  });

  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', role: 'user' as AppRole });

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<AppRole | ''>('');
  const [bulkBusy, setBulkBusy] = useState<null | 'role' | 'deactivate' | 'reactivate'>(null);
  const [confirmBulkDeactivate, setConfirmBulkDeactivate] = useState(false);

  const filtered = useMemo(() => {
    if (!users) return [] as ManagedUser[];
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && u.deactivated) return false;
      if (statusFilter === 'deactivated' && !u.deactivated) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        (u.fullName ?? '').toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter, statusFilter]);

  const selectableIds = useMemo(
    () => filtered.filter((u) => u.id !== currentUser?.id).map((u) => u.id),
    [filtered, currentUser?.id],
  );
  const selectedList = useMemo(
    () => (users ?? []).filter((u) => selected.has(u.id)),
    [users, selected],
  );
  const allVisibleSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someVisibleSelected =
    selectableIds.some((id) => selected.has(id)) && !allVisibleSelected;

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const toggleAllVisible = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of selectableIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const runBulk = async (
    kind: 'role' | 'deactivate' | 'reactivate',
    fn: (u: ManagedUser) => Promise<unknown>,
    filterFn: (u: ManagedUser) => boolean = () => true,
  ) => {
    const targets = selectedList.filter(filterFn);
    if (targets.length === 0) return;
    setBulkBusy(kind);
    try {
      await Promise.all(targets.map(fn));
      clearSelection();
      if (kind === 'role') setBulkRole('');
    } finally {
      setBulkBusy(null);
    }
  };

  const applyBulkRole = () => {
    if (!bulkRole) return;
    return runBulk(
      'role',
      (u) => updateUser.mutateAsync({ userId: u.id, role: bulkRole as AppRole }),
      (u) => u.role !== bulkRole,
    );
  };
  const applyBulkDeactivate = () =>
    runBulk(
      'deactivate',
      (u) => setActive.mutateAsync({ userId: u.id, active: false }),
      (u) => !u.deactivated,
    );
  const applyBulkReactivate = () =>
    runBulk(
      'reactivate',
      (u) => setActive.mutateAsync({ userId: u.id, active: true }),
      (u) => u.deactivated,
    );

  if (!roleLoading && role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (roleLoading || usersLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  const canSubmitCreate =
    createForm.email.trim().length > 0 &&
    createForm.password.length >= 8 &&
    createForm.fullName.trim().length > 0 &&
    !createUser.isPending;

  const handleCreate = async () => {
    if (!canSubmitCreate) return;
    try {
      await createUser.mutateAsync(createForm);
      setCreateOpen(false);
      setCreateForm({ email: '', password: '', fullName: '', role: 'user' });
    } catch {
      /* toast handled in hook */
    }
  };

  const openEdit = (u: ManagedUser) => {
    setEditUser(u);
    setEditForm({ fullName: u.fullName ?? '', role: u.role });
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    const changes: { userId: string; fullName?: string; role?: AppRole } = { userId: editUser.id };
    if (editForm.fullName.trim() !== (editUser.fullName ?? '').trim()) {
      changes.fullName = editForm.fullName.trim();
    }
    if (editForm.role !== editUser.role) {
      changes.role = editForm.role;
    }
    if (!changes.fullName && !changes.role) {
      setEditUser(null);
      return;
    }
    try {
      await updateUser.mutateAsync(changes);
      setEditUser(null);
    } catch {
      /* toast handled */
    }
  };

  const total = users?.length ?? 0;
  const adminCount = users?.filter((u) => u.role === 'admin').length ?? 0;
  const agentCount = users?.filter((u) => u.role === 'agent').length ?? 0;
  const activeCount = users?.filter((u) => !u.deactivated).length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container py-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" />
              User Management
            </h1>
            <p className="text-muted-foreground">
              Create, edit, and deactivate accounts. Assign admin, support agent, or user roles.
            </p>
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add user
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create new user</DialogTitle>
                <DialogDescription>
                  The user can sign in immediately with the credentials you set.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="create-fullname">Full name</Label>
                  <Input
                    id="create-fullname"
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    placeholder="Jane Doe"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-email">Email</Label>
                  <Input
                    id="create-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="jane@jmdev.io"
                    maxLength={255}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-password">Temporary password</Label>
                  <Input
                    id="create-password"
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    maxLength={128}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-role">Role</Label>
                  <Select
                    value={createForm.role}
                    onValueChange={(value) =>
                      setCreateForm({ ...createForm, role: value as AppRole })
                    }
                  >
                    <SelectTrigger id="create-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="agent">Support agent</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!canSubmitCreate}>
                  {createUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create user
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{total}</div><div className="text-xs text-muted-foreground">Total users</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{activeCount}</div><div className="text-xs text-muted-foreground">Active</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{adminCount}</div><div className="text-xs text-muted-foreground">Admins</div></CardContent></Card>
          <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{agentCount}</div><div className="text-xs text-muted-foreground">Support agents</div></CardContent></Card>
        </div>

        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>All users</CardTitle>
                <CardDescription>
                  {filtered.length} shown{selected.size > 0 ? ` · ${selected.size} selected` : ''}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8 w-56"
                    placeholder="Search name or email"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="admin">Admins</SelectItem>
                    <SelectItem value="agent">Support agents</SelectItem>
                    <SelectItem value="user">Users</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="deactivated">Deactivated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selected.size > 0 && (
              <div className="mt-4 flex items-center gap-2 flex-wrap rounded-md border bg-muted/40 p-3">
                <span className="text-sm font-medium">
                  {selected.size} selected
                </span>
                <div className="flex items-center gap-2 ml-2">
                  <Select value={bulkRole} onValueChange={(v) => setBulkRole(v as AppRole)}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Change role to…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="agent">Support agent</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={applyBulkRole}
                    disabled={!bulkRole || bulkBusy !== null}
                  >
                    {bulkBusy === 'role' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Apply role
                  </Button>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={applyBulkReactivate}
                    disabled={bulkBusy !== null || selectedList.every((u) => !u.deactivated)}
                  >
                    {bulkBusy === 'reactivate' ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <UserCheck className="h-4 w-4 mr-1" />
                    )}
                    Reactivate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmBulkDeactivate(true)}
                    disabled={bulkBusy !== null || selectedList.every((u) => u.deactivated)}
                  >
                    {bulkBusy === 'deactivate' ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <UserX className="h-4 w-4 mr-1" />
                    )}
                    Deactivate
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearSelection} disabled={bulkBusy !== null}>
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                      onCheckedChange={(v) => toggleAllVisible(v === true)}
                      disabled={selectableIds.length === 0}
                      aria-label="Select all visible users"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const info = roleConfig[u.role];
                  const isSelf = u.id === currentUser?.id;
                  const pending = setActive.isPending && setActive.variables?.userId === u.id;
                  return (
                    <TableRow key={u.id} className={u.deactivated ? 'opacity-60' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(u.id)}
                          onCheckedChange={(v) => toggleOne(u.id, v === true)}
                          disabled={isSelf}
                          aria-label={`Select ${u.email}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {u.fullName || <span className="text-muted-foreground italic">No name</span>}
                        {isSelf && <Badge variant="outline" className="ml-2">You</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={info.variant}>
                          <info.icon className="h-3 w-3 mr-1" />
                          {info.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.deactivated ? (
                          <Badge variant="destructive">Deactivated</Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.lastSignInAt
                          ? formatDistanceToNow(new Date(u.lastSignInAt), { addSuffix: true })
                          : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(u)}
                            disabled={isSelf}
                            title={isSelf ? "You can't edit your own account here" : 'Edit user'}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          {u.deactivated ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setActive.mutate({ userId: u.id, active: true })}
                              disabled={isSelf || pending}
                            >
                              {pending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <UserCheck className="h-4 w-4 mr-1" />}
                              Reactivate
                            </Button>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={isSelf}
                                  className="text-destructive hover:text-destructive"
                                  title={isSelf ? "You can't deactivate your own account" : 'Deactivate user'}
                                >
                                  <UserX className="h-4 w-4 mr-1" />
                                  Deactivate
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Deactivate {u.fullName || u.email}?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    They will be signed out immediately and won't be able to sign back in until you reactivate the account. Their tickets, comments, and history are preserved.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => setActive.mutate({ userId: u.id, active: false })}
                                  >
                                    Deactivate
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No users match the current filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={confirmBulkDeactivate} onOpenChange={setConfirmBulkDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deactivate {selectedList.filter((u) => !u.deactivated).length} user
              {selectedList.filter((u) => !u.deactivated).length === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will be signed out immediately and won't be able to sign back in until you reactivate them. Their tickets, comments, and history are preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmBulkDeactivate(false);
                applyBulkDeactivate();
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>{editUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-fullname">Full name</Label>
              <Input
                id="edit-fullname"
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm({ ...editForm, role: v as AppRole })}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="agent">Support agent</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateUser.isPending}>
              {updateUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}