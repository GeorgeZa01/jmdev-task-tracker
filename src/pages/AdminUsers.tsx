import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import {
  useUsersPage,
  useCreateUser,
  useUpdateUser,
  useSetUserActive,
  useDeleteUser,
  type ManagedUser,
  type AppRole,
  type UserSortKey,
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
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const roleConfig: Record<AppRole, { label: string; variant: 'default' | 'secondary' | 'outline'; icon: typeof Shield }> = {
  admin: { label: 'Admin', variant: 'default', icon: Shield },
  agent: { label: 'Support agent', variant: 'secondary', icon: UserCog },
  user: { label: 'User', variant: 'outline', icon: User },
};

type RoleFilter = AppRole | 'all';
type StatusFilter = 'all' | 'active' | 'deactivated';

interface BulkOutcome {
  kind: 'role' | 'deactivate' | 'reactivate';
  targetRole?: AppRole;
  successes: { id: string; label: string }[];
  failures: { id: string; label: string; message: string }[];
  skipped: { id: string; label: string; reason: string }[];
}

const PAGE_SIZES = [10, 25, 50, 100] as const;

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { data: role, isLoading: roleLoading } = useUserRole();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const setActive = useSetUserActive();
  const deleteUser = useDeleteUser();

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

  // Debounced search sent to the server so typing doesn't refetch on every key.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Pagination + sorting state, sent to the edge function.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [sortBy, setSortBy] = useState<UserSortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Reset to page 1 whenever the query narrows/widens.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, statusFilter, pageSize, sortBy, sortDir]);

  const {
    data: pageData,
    isLoading: usersLoading,
    isFetching,
  } = useUsersPage({
    page,
    pageSize,
    sortBy,
    sortDir,
    search: debouncedSearch,
    roleFilter,
    statusFilter,
  });

  const users = pageData?.users ?? [];
  const total = pageData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedMeta, setSelectedMeta] = useState<Map<string, ManagedUser>>(new Map());
  const [bulkRole, setBulkRole] = useState<AppRole | ''>('');
  const [bulkBusy, setBulkBusy] = useState<null | 'role' | 'deactivate' | 'reactivate'>(null);
  const [confirmBulkDeactivate, setConfirmBulkDeactivate] = useState(false);
  const [confirmBulkReactivate, setConfirmBulkReactivate] = useState(false);
  const [confirmBulkRole, setConfirmBulkRole] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkOutcome | null>(null);

  // The visible rows are already server-filtered/sorted/paged.
  const visible = users;

  const selectableIds = useMemo(
    () => visible.filter((u) => u.id !== currentUser?.id).map((u) => u.id),
    [visible, currentUser?.id],
  );
  const selectedList = useMemo(
    () => Array.from(selectedMeta.values()),
    [selectedMeta],
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
    setSelectedMeta((prev) => {
      const next = new Map(prev);
      if (checked) {
        const u = visible.find((v) => v.id === id);
        if (u) next.set(id, u);
      } else {
        next.delete(id);
      }
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
    setSelectedMeta((prev) => {
      const next = new Map(prev);
      for (const id of selectableIds) {
        if (checked) {
          const u = visible.find((v) => v.id === id);
          if (u) next.set(id, u);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  };
  const clearSelection = () => {
    setSelected(new Set());
    setSelectedMeta(new Map());
  };

  const labelFor = (u: ManagedUser) => u.fullName?.trim() || u.email;

  const runBulk = async (
    kind: 'role' | 'deactivate' | 'reactivate',
    fn: (u: ManagedUser) => Promise<unknown>,
    filterFn: (u: ManagedUser) => boolean,
    skipReason: string,
    targetRole?: AppRole,
  ) => {
    if (selectedList.length === 0) return;
    setBulkBusy(kind);
    const outcome: BulkOutcome = {
      kind,
      targetRole,
      successes: [],
      failures: [],
      skipped: [],
    };
    const results = await Promise.all(
      selectedList.map(async (u) => {
        if (!filterFn(u)) {
          outcome.skipped.push({ id: u.id, label: labelFor(u), reason: skipReason });
          return;
        }
        try {
          await fn(u);
          outcome.successes.push({ id: u.id, label: labelFor(u) });
        } catch (err) {
          outcome.failures.push({
            id: u.id,
            label: labelFor(u),
            message: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }),
    );
    void results;
    setBulkBusy(null);
    setBulkResult(outcome);
    // Only clear the ones that succeeded so failures stay selected for retry.
    if (outcome.successes.length > 0) {
      const successIds = new Set(outcome.successes.map((s) => s.id));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of successIds) next.delete(id);
        return next;
      });
      setSelectedMeta((prev) => {
        const next = new Map(prev);
        for (const id of successIds) next.delete(id);
        return next;
      });
    }
    if (kind === 'role') setBulkRole('');
  };

  const applyBulkRole = () => {
    if (!bulkRole) return;
    return runBulk(
      'role',
      (u) => updateUser.mutateAsync({ userId: u.id, role: bulkRole as AppRole }),
      (u) => u.role !== bulkRole,
      'Already has this role',
      bulkRole as AppRole,
    );
  };
  const applyBulkDeactivate = () =>
    runBulk(
      'deactivate',
      (u) => setActive.mutateAsync({ userId: u.id, active: false }),
      (u) => !u.deactivated,
      'Already deactivated',
    );
  const applyBulkReactivate = () =>
    runBulk(
      'reactivate',
      (u) => setActive.mutateAsync({ userId: u.id, active: true }),
      (u) => u.deactivated,
      'Already active',
    );

  if (!roleLoading && role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  if (roleLoading || (usersLoading && !pageData)) {
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

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  const toggleSort = (key: UserSortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir(key === 'fullName' || key === 'email' || key === 'role' ? 'asc' : 'desc');
    }
  };

  const SortHeader = ({ label, sortKey, className }: { label: string; sortKey: UserSortKey; className?: string }) => {
    const active = sortBy === sortKey;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => toggleSort(sortKey)}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {label}
          <Icon className={`h-3 w-3 ${active ? 'text-foreground' : 'text-muted-foreground/60'}`} />
        </button>
      </TableHead>
    );
  };

  const bulkRoleEligible = selectedList.filter((u) => bulkRole && u.role !== bulkRole);
  const bulkDeactivateEligible = selectedList.filter((u) => !u.deactivated);
  const bulkReactivateEligible = selectedList.filter((u) => u.deactivated);

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

        <Card className="border-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>All users</CardTitle>
                <CardDescription>
                  {total === 0
                    ? 'No users match the current filters'
                    : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
                  {selected.size > 0 ? ` · ${selected.size} selected` : ''}
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
                    onClick={() => setConfirmBulkRole(true)}
                    disabled={!bulkRole || bulkBusy !== null || bulkRoleEligible.length === 0}
                  >
                    {bulkBusy === 'role' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Apply role
                  </Button>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmBulkReactivate(true)}
                    disabled={bulkBusy !== null || bulkReactivateEligible.length === 0}
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
                    disabled={bulkBusy !== null || bulkDeactivateEligible.length === 0}
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
          <CardContent className="relative">
            {isFetching && pageData && (
              <div className="absolute right-6 top-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Updating…
              </div>
            )}
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
                  <SortHeader label="Name" sortKey="fullName" />
                  <SortHeader label="Email" sortKey="email" />
                  <SortHeader label="Role" sortKey="role" />
                  <SortHeader label="Status" sortKey="deactivated" />
                  <SortHeader label="Last sign-in" sortKey="lastSignInAt" />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((u) => {
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
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isSelf || deleteUser.isPending}
                                className="text-destructive hover:text-destructive"
                                title={isSelf ? "You can't delete your own account" : 'Delete user'}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {u.fullName || u.email}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes the account and its profile. It cannot be undone. Tickets and comments they wrote stay in place. If you only want to block access, deactivate them instead.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => deleteUser.mutate({ userId: u.id })}
                                >
                                  Delete permanently
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No users match the current filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => setPageSize(Number(v))}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isFetching}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isFetching}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={confirmBulkDeactivate} onOpenChange={setConfirmBulkDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deactivate {bulkDeactivateEligible.length} user
              {bulkDeactivateEligible.length === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will be signed out immediately and won't be able to sign back in until you reactivate them. Their tickets, comments, and history are preserved.
              {selectedList.length !== bulkDeactivateEligible.length && (
                <> {selectedList.length - bulkDeactivateEligible.length} already-deactivated account
                  {selectedList.length - bulkDeactivateEligible.length === 1 ? '' : 's'} in your selection will be skipped.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-40 overflow-y-auto text-sm rounded border p-2 space-y-1">
            {bulkDeactivateEligible.slice(0, 20).map((u) => (
              <div key={u.id} className="truncate">{labelFor(u)} <span className="text-muted-foreground">({u.email})</span></div>
            ))}
            {bulkDeactivateEligible.length > 20 && (
              <div className="text-xs text-muted-foreground">…and {bulkDeactivateEligible.length - 20} more</div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmBulkDeactivate(false);
                applyBulkDeactivate();
              }}
            >
              Deactivate {bulkDeactivateEligible.length}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmBulkReactivate} onOpenChange={setConfirmBulkReactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Reactivate {bulkReactivateEligible.length} user
              {bulkReactivateEligible.length === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will be able to sign in again immediately.
              {selectedList.length !== bulkReactivateEligible.length && (
                <> {selectedList.length - bulkReactivateEligible.length} already-active account
                  {selectedList.length - bulkReactivateEligible.length === 1 ? '' : 's'} in your selection will be skipped.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-40 overflow-y-auto text-sm rounded border p-2 space-y-1">
            {bulkReactivateEligible.slice(0, 20).map((u) => (
              <div key={u.id} className="truncate">{labelFor(u)} <span className="text-muted-foreground">({u.email})</span></div>
            ))}
            {bulkReactivateEligible.length > 20 && (
              <div className="text-xs text-muted-foreground">…and {bulkReactivateEligible.length - 20} more</div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmBulkReactivate(false);
                applyBulkReactivate();
              }}
            >
              Reactivate {bulkReactivateEligible.length}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmBulkRole} onOpenChange={setConfirmBulkRole}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Change role to {bulkRole ? roleConfig[bulkRole as AppRole].label : ''} for {bulkRoleEligible.length} user
              {bulkRoleEligible.length === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Role changes take effect immediately and will grant or revoke permissions.
              {selectedList.length !== bulkRoleEligible.length && (
                <> {selectedList.length - bulkRoleEligible.length} account
                  {selectedList.length - bulkRoleEligible.length === 1 ? '' : 's'} already at this role will be skipped.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-40 overflow-y-auto text-sm rounded border p-2 space-y-1">
            {bulkRoleEligible.slice(0, 20).map((u) => (
              <div key={u.id} className="truncate">
                {labelFor(u)} <span className="text-muted-foreground">({u.email})</span>{' '}
                <span className="text-xs text-muted-foreground">— {roleConfig[u.role].label} → {bulkRole ? roleConfig[bulkRole as AppRole].label : ''}</span>
              </div>
            ))}
            {bulkRoleEligible.length > 20 && (
              <div className="text-xs text-muted-foreground">…and {bulkRoleEligible.length - 20} more</div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmBulkRole(false);
                applyBulkRole();
              }}
            >
              Apply to {bulkRoleEligible.length}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!bulkResult} onOpenChange={(open) => !open && setBulkResult(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {bulkResult?.kind === 'role' && `Role change: ${bulkResult?.targetRole ? roleConfig[bulkResult.targetRole].label : ''}`}
              {bulkResult?.kind === 'deactivate' && 'Deactivation results'}
              {bulkResult?.kind === 'reactivate' && 'Reactivation results'}
            </DialogTitle>
            <DialogDescription>
              {bulkResult?.successes.length ?? 0} succeeded ·{' '}
              {bulkResult?.failures.length ?? 0} failed ·{' '}
              {bulkResult?.skipped.length ?? 0} skipped
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {bulkResult && bulkResult.successes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-green-600 mb-1">
                  <CheckCircle2 className="h-4 w-4" /> Succeeded ({bulkResult.successes.length})
                </div>
                <ul className="text-sm space-y-0.5 pl-6 list-disc">
                  {bulkResult.successes.map((s) => (
                    <li key={s.id} className="truncate">{s.label}</li>
                  ))}
                </ul>
              </div>
            )}
            {bulkResult && bulkResult.failures.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-1">
                  <XCircle className="h-4 w-4" /> Failed ({bulkResult.failures.length})
                </div>
                <ul className="text-sm space-y-1 pl-6 list-disc">
                  {bulkResult.failures.map((f) => (
                    <li key={f.id}>
                      <span className="font-medium">{f.label}</span>
                      <span className="text-muted-foreground"> — {f.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {bulkResult && bulkResult.skipped.length > 0 && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">
                  Skipped ({bulkResult.skipped.length})
                </div>
                <ul className="text-sm text-muted-foreground space-y-0.5 pl-6 list-disc">
                  {bulkResult.skipped.map((s) => (
                    <li key={s.id} className="truncate">
                      {s.label} — {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setBulkResult(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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