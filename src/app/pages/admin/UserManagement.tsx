import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import {
  Users, UserPlus, Edit, Trash2, Search, Shield, Wrench, User, Sun, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { usePanels } from '../../contexts/PanelContext';
import type { SolarPanel } from '../../data/mockData';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'technicien' | 'user';
  status: 'actif' | 'inactif';
  createdAt: string;
  assignedPanels?: string[];
}

// ─── Color helpers ─────────────────────────────────────────────────────────────

const colorDot: Record<SolarPanel['color'], string> = {
  amber:  'bg-amber-500',
  blue:   'bg-blue-500',
  green:  'bg-green-500',
  purple: 'bg-purple-500',
  rose:   'bg-rose-500',
};

// ─── Edit User Dialog ──────────────────────────────────────────────────────────

function EditUserDialog({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const [form, setForm] = useState({
    name:   user.name,
    email:  user.email,
    role:   user.role,
    status: user.status,
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Nom et email sont obligatoires');
      return;
    }
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.id), {
        displayName: form.name,
        name:        form.name,
        email:       form.email,
        role:        form.role,
        status:      form.status,
        updatedAt:   new Date().toISOString(),
      });
      toast.success(`Utilisateur ${form.name} mis à jour`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-amber-500" />
            Modifier l'utilisateur
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Avatar preview */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg">
              {form.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-gray-900">{form.name || '—'}</p>
              <p className="text-sm text-gray-500">{form.email}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nom complet *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ahmed Ben Ali"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="user@solarwatch.tn"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as AppUser['role'] })}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="user">Utilisateur</option>
                <option value="technicien">Technicien</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Statut</Label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as AppUser['status'] })}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
              </select>
            </div>
          </div>

          {/* Role description */}
          <div className={`rounded-lg p-3 text-sm ${
            form.role === 'admin'      ? 'bg-purple-50 text-purple-800 border border-purple-200' :
            form.role === 'technicien' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                                         'bg-gray-50 text-gray-700 border border-gray-200'
          }`}>
            {form.role === 'admin'      && '🛡️ Accès complet — gestion users, panneaux, alertes, rapports'}
            {form.role === 'technicien' && '🔧 Accès technicien — interventions, surveillance, alertes'}
            {form.role === 'user'       && '👤 Accès limité — consultation des panneaux assignés uniquement'}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            onClick={handleSave}
            disabled={loading || !form.name.trim() || !form.email.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            <Edit className="h-4 w-4 mr-2" />
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create User Dialog ────────────────────────────────────────────────────────

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.name) {
      toast.error('Tous les champs sont obligatoires');
      return;
    }
    setLoading(true);
    try {
      // Créer dans Firestore (sans Firebase Auth pour l'instant)
      const id = `user-${Date.now()}`;
      await setDoc(doc(db, 'users', id), {
        displayName: form.name,
        name:        form.name,
        email:       form.email,
        role:        form.role,
        status:      'actif',
        createdAt:   new Date().toISOString(),
      });
      toast.success(`Utilisateur ${form.name} créé`);
      onClose();
      setForm({ name: '', email: '', password: '', role: 'user' });
    } catch (err) {
      toast.error('Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-amber-500" /> Nouvel utilisateur
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nom complet *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ahmed Ben Ali" />
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@solarwatch.tn" />
          </div>
          <div className="space-y-1.5">
            <Label>Mot de passe *</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          </div>
          <div className="space-y-1.5">
            <Label>Rôle</Label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white"
            >
              <option value="user">Utilisateur</option>
              <option value="technicien">Technicien</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleCreate} disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-white">
            <UserPlus className="h-4 w-4 mr-2" />
            {loading ? 'Création...' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Panel Assignment Dialog ───────────────────────────────────────────────────

function PanelAssignDialog({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const { panels, userAssignments, assignPanels } = usePanels();
  const current = user.assignedPanels ?? userAssignments[user.email] ?? [];
  const [selected, setSelected] = useState<string[]>(current);

  const toggle = (panelId: string) => {
    setSelected((prev) =>
      prev.includes(panelId) ? prev.filter((id) => id !== panelId) : [...prev, panelId]
    );
  };

  const handleSave = async () => {
    assignPanels(user.email, selected);
    await updateDoc(doc(db, 'users', user.id), { assignedPanels: selected });
    toast.success(`Panneaux assignés à ${user.name}`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-amber-500" />
            Panneaux assignés — {user.name}
          </DialogTitle>
        </DialogHeader>
        <div className="py-3">
          <p className="text-sm text-gray-500 mb-4">Sélectionnez les panneaux accessibles.</p>
          <div className="space-y-2">
            {panels.map((panel) => {
              const isSelected = selected.includes(panel.id);
              return (
                <button
                  key={panel.id}
                  onClick={() => toggle(panel.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                    isSelected ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className={`h-2.5 w-2.5 rounded-full ${colorDot[panel.color]}`} />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{panel.id} — {panel.name}</p>
                    <p className="text-xs text-gray-400">{panel.location}</p>
                  </div>
                  {isSelected && (
                    <div className="h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            {selected.length}/{panels.length} panneaux sélectionnés
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} className="bg-amber-500 hover:bg-amber-600 text-white">
            <Sun className="h-4 w-4 mr-2" /> Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ─────────────────────────────────────────────────────

function DeleteConfirmDialog({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'users', user.id));
      toast.success(`Utilisateur ${user.name} supprimé`);
      onClose();
    } catch {
      toast.error('Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" /> Supprimer l'utilisateur
          </DialogTitle>
        </DialogHeader>
        <div className="py-3">
          <p className="text-gray-700">
            Êtes-vous sûr de vouloir supprimer <strong>{user.name}</strong> ({user.email}) ?
          </p>
          <p className="text-sm text-red-600 mt-2">Cette action est irréversible.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            onClick={handleDelete}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {loading ? 'Suppression...' : 'Supprimer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function UserManagement() {
  const [users, setUsers]           = useState<AppUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editTarget, setEditTarget]     = useState<AppUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [assignTarget, setAssignTarget] = useState<AppUser | null>(null);
  const [createOpen, setCreateOpen]     = useState(false);
  const { userAssignments, panels }     = usePanels();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map((d) => {
        const item = d.data();
        return {
          id:             d.id,
          name:           item.displayName || item.name || 'Inconnu',
          email:          item.email || '',
          role:           item.role || 'user',
          status:         item.status || 'actif',
          createdAt:      item.createdAt?.toDate?.()?.toISOString?.() || item.createdAt || new Date().toISOString(),
          assignedPanels: item.assignedPanels || [],
        } as AppUser;
      });
      setUsers(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleIcon = (role: string) => {
    if (role === 'admin')      return <Shield className="h-4 w-4" />;
    if (role === 'technicien') return <Wrench className="h-4 w-4" />;
    return <User className="h-4 w-4" />;
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin:      'bg-purple-100 text-purple-700 border-purple-200',
      technicien: 'bg-blue-100 text-blue-700 border-blue-200',
      user:       'bg-gray-100 text-gray-700 border-gray-200',
    };
    return colors[role] ?? colors.user;
  };

  const getPanelBadges = (user: AppUser) => {
    if (user.role !== 'user') return <span className="text-xs text-gray-400">Accès total</span>;
    const assigned = user.assignedPanels?.length ? user.assignedPanels : (userAssignments[user.email] ?? []);
    if (assigned.length === 0) return <span className="text-xs text-gray-400 italic">Aucun panneau</span>;
    if (assigned.length === panels.length) return <span className="text-xs text-green-600 font-medium">Tous les panneaux</span>;
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {assigned.map((pid) => {
          const panel = panels.find((p) => p.id === pid);
          return panel ? (
            <span key={pid} className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs text-white ${colorDot[panel.color]}`}>
              {pid}
            </span>
          ) : null;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Utilisateurs</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez les comptes, permissions et accès aux panneaux</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-white">
          <UserPlus className="h-4 w-4 mr-2" /> Nouvel Utilisateur
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',           value: users.length,                                        color: 'text-gray-900',   icon: Users  },
          { label: 'Administrateurs', value: users.filter((u) => u.role === 'admin').length,      color: 'text-purple-600', icon: Shield },
          { label: 'Techniciens',     value: users.filter((u) => u.role === 'technicien').length, color: 'text-blue-600',   icon: Wrench },
          { label: 'Utilisateurs',    value: users.filter((u) => u.role === 'user').length,       color: 'text-gray-600',   icon: User   },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
              <stat.icon className="h-7 w-7 text-gray-300" />
            </div>
          </Card>
        ))}
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" />
          <Input
            placeholder="Rechercher par nom ou email…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 border-0 shadow-none focus-visible:ring-0"
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <p className="text-center text-gray-500 py-8">Chargement des utilisateurs...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Panneaux</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Créé le</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-medium text-sm shrink-0">
                          {u.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant="outline" className={`flex items-center gap-1 w-fit text-xs ${getRoleBadge(u.role)}`}>
                        {getRoleIcon(u.role)}
                        {u.role === 'admin' ? 'Administrateur' : u.role === 'technicien' ? 'Technicien' : 'Utilisateur'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      {u.role === 'user' ? (
                        <div className="flex items-center gap-2">
                          {getPanelBadges(u)}
                          <button
                            onClick={() => setAssignTarget(u)}
                            className="text-xs text-amber-600 hover:underline flex items-center gap-1 shrink-0"
                          >
                            <Sun className="h-3 w-3" /> Modifier
                          </button>
                        </div>
                      ) : (
                        getPanelBadges(u)
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        variant="outline"
                        className={`text-xs ${u.status === 'actif' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {u.status === 'actif' ? '● Actif' : '○ Inactif'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-xs text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString('fr-TN')}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline" size="sm"
                          className="text-amber-600 hover:bg-amber-50 hover:border-amber-300"
                          onClick={() => setEditTarget(u)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          className="text-red-600 hover:bg-red-50 hover:border-red-300"
                          onClick={() => setDeleteTarget(u)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Dialogs */}
      {editTarget   && <EditUserDialog   user={editTarget}   onClose={() => setEditTarget(null)}   />}
      {deleteTarget && <DeleteConfirmDialog user={deleteTarget} onClose={() => setDeleteTarget(null)} />}
      {assignTarget && <PanelAssignDialog user={assignTarget} onClose={() => setAssignTarget(null)} />}
      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
