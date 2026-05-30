import { useState, useRef, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { useInterventions } from '../contexts/InterventionContext';
import type { Intervention, InterventionStatus, InterventionPriority } from '../contexts/InterventionContext';
import {
  Wrench, Plus, MessageSquare, Clock, CheckCircle2,
  AlertTriangle, Info, ChevronRight, Send, ArrowLeft,
  User, Shield, ClipboardList, CircleDot,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Helpers ───────────────────────────────────────────────────
const statusConfig: Record<InterventionStatus, { label: string; cls: string; icon: React.ElementType }> = {
  pending:     { label: 'En attente', cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
  in_progress: { label: 'En cours',   cls: 'bg-blue-100 text-blue-700 border-blue-200',       icon: CircleDot },
  done:        { label: 'Terminée',   cls: 'bg-green-100 text-green-700 border-green-200',    icon: CheckCircle2 },
};

const priorityConfig: Record<InterventionPriority, { label: string; cls: string; icon: React.ElementType }> = {
  critical: { label: 'Critique', cls: 'bg-red-100 text-red-700 border-red-200',          icon: AlertTriangle },
  warning:  { label: 'Warning',  cls: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertTriangle },
  info:     { label: 'Info',     cls: 'bg-blue-100 text-blue-700 border-blue-200',        icon: Info },
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-TN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Intervention Card ─────────────────────────────────────────
function InterventionCard({ intervention, onClick }: { intervention: Intervention; onClick: () => void }) {
  const status   = statusConfig[intervention.status];
  const priority = priorityConfig[intervention.priority];
  const StatusIcon   = status.icon;
  const PriorityIcon = priority.icon;

  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-md transition-shadow border-l-4"
      style={{
        borderLeftColor:
          intervention.priority === 'critical' ? '#ef4444' :
          intervention.priority === 'warning'  ? '#f97316' : '#3b82f6',
      }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className={`text-xs ${priority.cls}`}>
              <PriorityIcon className="h-3 w-3 mr-1" />{priority.label}
            </Badge>
            <Badge variant="outline" className={`text-xs ${status.cls}`}>
              <StatusIcon className="h-3 w-3 mr-1" />{status.label}
            </Badge>
          </div>
          <h3 className="font-medium text-gray-900 truncate">{intervention.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{intervention.description}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><User className="h-3 w-3" />{intervention.assignedToName}</span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {intervention.messages.length} message{intervention.messages.length !== 1 ? 's' : ''}
            </span>
            <span>{formatRelativeTime(intervention.updatedAt)}</span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-400 mt-1 shrink-0" />
      </div>
    </Card>
  );
}

// ─── Detail / Chat View ────────────────────────────────────────
function InterventionDetail({ intervention, onBack }: { intervention: Intervention; onBack: () => void }) {
  const { user } = useAuth();
  const { sendMessage, updateStatus } = useInterventions();
  const [message, setMessage]         = useState('');
  const [notes, setNotes]             = useState(intervention.notes);
  const [editingNotes, setEditingNotes] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [intervention.messages]);

  const handleSend = () => {
    if (!message.trim() || !user) return;
    sendMessage(intervention.id, user.email, user.name, user.role as 'admin' | 'technicien', message.trim());
    setMessage('');
    toast.success('Message envoyé');
  };

  const handleStatusChange = (newStatus: InterventionStatus) => {
    updateStatus(intervention.id, newStatus);
    toast.success(`Statut mis à jour : ${statusConfig[newStatus].label}`);
  };

  const handleSaveNotes = () => {
    updateStatus(intervention.id, intervention.status, notes);
    setEditingNotes(false);
    toast.success('Notes sauvegardées');
  };

  const status   = statusConfig[intervention.status];
  const priority = priorityConfig[intervention.priority];
  const StatusIcon   = status.icon;
  const PriorityIcon = priority.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Button variant="outline" size="icon" onClick={onBack} className="shrink-0 mt-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className={`text-xs ${priority.cls}`}>
              <PriorityIcon className="h-3 w-3 mr-1" />{priority.label}
            </Badge>
            <Badge variant="outline" className={`text-xs ${status.cls}`}>
              <StatusIcon className="h-3 w-3 mr-1" />{status.label}
            </Badge>
          </div>
          <h2 className="font-semibold text-gray-900">{intervention.title}</h2>
          <p className="text-xs text-gray-500">
            Créée par {intervention.createdByName} · {formatDateTime(intervention.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <h3 className="font-medium text-sm text-gray-700 flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Détails
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Description</p>
                <p className="text-gray-800">{intervention.description}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Assigné à</p>
                <p className="text-gray-800 font-medium">{intervention.assignedToName}</p>
                <p className="text-xs text-gray-400">{intervention.assignedTo}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Dernière mise à jour</p>
                <p className="text-gray-800">{formatDateTime(intervention.updatedAt)}</p>
              </div>
            </div>
          </Card>

          {user?.role === 'technicien' && intervention.status !== 'done' && (
            <Card className="p-4 space-y-2">
              <h3 className="font-medium text-sm text-gray-700">Changer le statut</h3>
              <div className="space-y-2">
                {intervention.status === 'pending' && (
                  <Button className="w-full justify-start gap-2 bg-blue-600 hover:bg-blue-700 text-white" size="sm"
                    onClick={() => handleStatusChange('in_progress')}>
                    <CircleDot className="h-4 w-4" /> Démarrer l'intervention
                  </Button>
                )}
                {intervention.status === 'in_progress' && (
                  <Button className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700 text-white" size="sm"
                    onClick={() => handleStatusChange('done')}>
                    <CheckCircle2 className="h-4 w-4" /> Marquer comme terminée
                  </Button>
                )}
              </div>
            </Card>
          )}

          {user?.role === 'admin' && (
            <Card className="p-4 space-y-2">
              <h3 className="font-medium text-sm text-gray-700">Gestion du statut</h3>
              <Select value={intervention.status} onValueChange={(val) => handleStatusChange(val as InterventionStatus)}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="done">Terminée</SelectItem>
                </SelectContent>
              </Select>
            </Card>
          )}

          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm text-gray-700">Notes de terrain</h3>
              {user?.role === 'technicien' && !editingNotes && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingNotes(true)}>
                  Modifier
                </Button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes de terrain, observations..." rows={4} className="text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveNotes} className="bg-amber-500 hover:bg-amber-600 text-white">
                    Sauvegarder
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditingNotes(false); setNotes(intervention.notes); }}>
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 min-h-[40px]">
                {intervention.notes || <span className="text-gray-400 italic">Aucune note</span>}
              </p>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="flex flex-col h-[520px]">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50 rounded-t-lg">
              <MessageSquare className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-sm text-gray-700">Communication Admin ↔ Technicien</span>
              <Badge variant="outline" className="ml-auto text-xs">
                {intervention.messages.length} message{intervention.messages.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {intervention.messages.map((msg) => {
                const isMe = msg.from === user?.email;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[80%] space-y-1">
                      <div className={`flex items-center gap-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                          msg.fromRole === 'admin' ? 'bg-purple-500' : 'bg-blue-500'}`}>
                          {msg.fromRole === 'admin'
                            ? <Shield className="h-3 w-3 text-white" />
                            : <Wrench className="h-3 w-3 text-white" />}
                        </div>
                        <span className="text-xs text-gray-500 font-medium">{msg.fromName}</span>
                        <span className="text-xs text-gray-400">{formatRelativeTime(msg.timestamp)}</span>
                      </div>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isMe ? 'bg-amber-500 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {intervention.status !== 'done' ? (
              <div className="p-4 border-t flex gap-2">
                <Input value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="Écrire un message..." className="flex-1 text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
                <Button onClick={handleSend} disabled={!message.trim()}
                  className="bg-amber-500 hover:bg-amber-600 text-white shrink-0" size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="p-4 border-t bg-gray-50 rounded-b-lg">
                <p className="text-xs text-center text-gray-500 flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  Intervention terminée — messagerie clôturée
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Create Intervention Modal ─────────────────────────────────
function CreateInterventionModal({ open, onClose, alertId, alertTitle }: {
  open: boolean; onClose: () => void; alertId?: string; alertTitle?: string;
}) {
  const { user } = useAuth();
  const { createIntervention } = useInterventions();
  const [form, setForm] = useState({
    title: alertTitle ? `Intervention — ${alertTitle}` : '',
    description: '',
    priority: 'warning' as InterventionPriority,
    assignedTo: 'tech@solarwatch.tn',
    assignedToName: 'Mehdi Gharbi',
  });

  useEffect(() => {
    if (alertTitle) setForm((f) => ({ ...f, title: `Intervention — ${alertTitle}` }));
  }, [alertTitle]);

  const handleSubmit = () => {
    if (!form.title.trim() || !form.description.trim() || !user) return;
    createIntervention({
      title: form.title, description: form.description, priority: form.priority,
      assignedTo: form.assignedTo, assignedToName: form.assignedToName,
      createdBy: user.email, createdByName: user.name, alertId,
    });
    toast.success('Intervention créée et assignée à ' + form.assignedToName);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" aria-describedby="intervention-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-500" />
            Créer une intervention
          </DialogTitle>
          <DialogDescription id="intervention-desc">
            Remplissez les informations pour créer un ordre d'intervention et l'assigner à un technicien.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Titre *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex : Vérification tension panneau P1" />
          </div>
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Décrivez l'intervention à effectuer..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priorité</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as InterventionPriority })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">🔴 Critique</SelectItem>
                  <SelectItem value="warning">🟠 Warning</SelectItem>
                  <SelectItem value="info">🔵 Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigner à</Label>
              <Select value={form.assignedTo} onValueChange={(v) => {
                const name = v === 'tech@solarwatch.tn' ? 'Mehdi Gharbi' : 'Technicien';
                setForm({ ...form, assignedTo: v, assignedToName: name });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tech@solarwatch.tn">Mehdi Gharbi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {alertId && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              🔗 Liée à l'alerte #{alertId} : <strong>{alertTitle}</strong>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!form.title.trim() || !form.description.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-white">
            <Wrench className="h-4 w-4 mr-2" />
            Créer l'intervention
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────
export function Interventions() {
  const { user } = useAuth();
  const { interventions } = useInterventions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab]   = useState<string>('all');

  const isAdmin = user?.role === 'admin';

  const myInterventions = isAdmin
    ? interventions
    : interventions.filter((i) => i.assignedTo === user?.email);

  const pending    = myInterventions.filter((i) => i.status === 'pending');
  const inProgress = myInterventions.filter((i) => i.status === 'in_progress');
  const done       = myInterventions.filter((i) => i.status === 'done');

  const tabList: { value: string; label: string; items: Intervention[] }[] = [
    { value: 'all',         label: `Toutes (${myInterventions.length})`, items: myInterventions },
    { value: 'pending',     label: `En attente (${pending.length})`,     items: pending },
    { value: 'in_progress', label: `En cours (${inProgress.length})`,    items: inProgress },
    { value: 'done',        label: `Terminées (${done.length})`,         items: done },
  ];

  const selected = selectedId ? interventions.find((i) => i.id === selectedId) : null;

  if (selected) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Interventions</h1>
          <p className="text-sm text-gray-500 mt-1">Détail de l'intervention</p>
        </div>
        <InterventionDetail intervention={selected} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Interventions</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin ? "Gestion des ordres d'intervention" : 'Mes interventions assignées'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-white shrink-0">
            <Plus className="h-4 w-4 mr-2" /> Créer une intervention
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 bg-gray-50">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-800">{myInterventions.length}</p>
        </Card>
        <Card className="p-3 bg-yellow-50 border-yellow-200">
          <p className="text-xs text-gray-600">En attente</p>
          <p className="text-2xl font-bold text-yellow-700">{pending.length}</p>
        </Card>
        <Card className="p-3 bg-blue-50 border-blue-200">
          <p className="text-xs text-gray-600">En cours</p>
          <p className="text-2xl font-bold text-blue-700">{inProgress.length}</p>
        </Card>
        <Card className="p-3 bg-green-50 border-green-200">
          <p className="text-xs text-gray-600">Terminées</p>
          <p className="text-2xl font-bold text-green-700">{done.length}</p>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full">
          {tabList.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="flex-1 text-xs sm:text-sm">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabList.map((t) => (
          <TabsContent key={t.value} value={t.value} className="space-y-2 mt-4">
            {t.items.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Wrench className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucune intervention</p>
              </div>
            ) : (
              t.items.map((intervention) => (
                <InterventionCard key={intervention.id} intervention={intervention}
                  onClick={() => setSelectedId(intervention.id)} />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>

      <CreateInterventionModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
