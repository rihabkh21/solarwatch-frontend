import { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Search, Bell, Wrench, AlertTriangle, Info, Clock, CheckCircle2 } from 'lucide-react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Alert, InterventionPriority } from '../data/mockData';
import { useAuth } from '../contexts/AuthContext';
import { useInterventions } from '../contexts/InterventionContext';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

// ─── Alert Row Card ────────────────────────────────────────────
function AlertRow({ alert, onCreateIntervention, isAdmin }: {
  alert: Alert; onCreateIntervention: (alert: Alert) => void; isAdmin: boolean;
}) {
  const typeConfig = {
    critical: { cls: 'bg-red-50 border-red-200',       badge: 'bg-red-100 text-red-700 border-red-200',          label: 'Critique', icon: AlertTriangle },
    warning:  { cls: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Warning',  icon: AlertTriangle },
    info:     { cls: 'bg-blue-50 border-blue-200',     badge: 'bg-blue-100 text-blue-700 border-blue-200',       label: 'Info',     icon: Info },
  };
  const cfg  = typeConfig[alert.type] ?? typeConfig.info;
  const Icon = cfg.icon;

  return (
    <Card className={`p-4 border ${cfg.cls}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${
            alert.type === 'critical' ? 'text-red-600' :
            alert.type === 'warning'  ? 'text-orange-600' : 'text-blue-600'}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className={`text-xs ${cfg.badge}`}>{cfg.label}</Badge>
              {alert.resolved
                ? <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Résolue
                  </Badge>
                : <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">
                    <Clock className="h-3 w-3 mr-1" /> Active
                  </Badge>}
            </div>
            <p className="font-medium text-gray-900 text-sm">{alert.message}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {alert.sensor} · {new Date(alert.timestamp).toLocaleString('fr-TN', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
        </div>
        {isAdmin && !alert.resolved && (
          <Button size="sm" variant="outline"
            className="shrink-0 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={() => onCreateIntervention(alert)}>
            <Wrench className="h-3.5 w-3.5 mr-1" /> Intervention
          </Button>
        )}
      </div>
    </Card>
  );
}

// ─── Quick Create Modal ────────────────────────────────────────
function QuickCreateModal({ open, onClose, alert }: { open: boolean; onClose: () => void; alert: Alert | null }) {
  const { user }             = useAuth();
  const { createIntervention } = useInterventions();
  const navigate             = useNavigate();
  const [form, setForm]      = useState({ title: '', description: '', priority: 'warning' as InterventionPriority });
  const [initialized, setInitialized] = useState(false);

  if (open && alert && !initialized) {
    setForm({
      title:       `Intervention — ${alert.message}`,
      description: `Alerte détectée sur ${alert.sensor}. ${alert.message}`,
      priority:    alert.type as InterventionPriority,
    });
    setInitialized(true);
  }
  if (!open && initialized) setInitialized(false);

  const handleSubmit = () => {
    if (!user || !alert) return;
    createIntervention({
      title: form.title, description: form.description, priority: form.priority,
      assignedTo: 'tech@solarwatch.tn', assignedToName: 'Mehdi Gharbi',
      createdBy: user.email, createdByName: user.name, alertId: alert.id,
    });
    toast.success('Intervention créée et assignée à Mehdi Gharbi');
    onClose();
    navigate('/interventions');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" aria-describedby="alert-intervention-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-500" /> Créer une intervention
          </DialogTitle>
          <DialogDescription id="alert-intervention-desc">
            Créez un ordre d'intervention à partir de cette alerte et assignez-le à un technicien.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Titre *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
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
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            👤 Assignée à : <strong>Mehdi Gharbi</strong> (tech@solarwatch.tn)
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!form.title.trim() || !form.description.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-white">
            <Wrench className="h-4 w-4 mr-2" /> Créer et assigner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Alerts Page ──────────────────────────────────────────
export function Alerts() {
  const { user }        = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [alerts, setAlerts]           = useState<Alert[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [modalOpen, setModalOpen]     = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id:        doc.id,
          type:      d.severity || d.type || 'info',
          sensor:    d.sensorData?.sensor || d.sensor || 'Système',
          message:   d.message || '',
          timestamp: d.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
          resolved:  d.resolved ?? false,
        } as Alert;
      });
      setAlerts(data);
      setLoading(false);
    }, (error) => {
      console.error('Erreur alertes:', error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredAlerts  = alerts.filter(a =>
    a.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.sensor.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const criticalAlerts  = filteredAlerts.filter(a => a.type === 'critical');
  const warningAlerts   = filteredAlerts.filter(a => a.type === 'warning');
  const infoAlerts      = filteredAlerts.filter(a => a.type === 'info');

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alertes</h1>
          <p className="text-sm text-gray-500 mt-1">Notifications du système</p>
        </div>
        <Bell className="h-6 w-6 text-gray-400 mt-1" />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Rechercher..." value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 bg-red-50 border-red-200">
          <p className="text-xs text-gray-600">Critiques</p>
          <p className="text-2xl font-bold text-red-700">{criticalAlerts.length}</p>
        </Card>
        <Card className="p-3 bg-orange-50 border-orange-200">
          <p className="text-xs text-gray-600">Warnings</p>
          <p className="text-2xl font-bold text-orange-700">{warningAlerts.length}</p>
        </Card>
        <Card className="p-3 bg-blue-50 border-blue-200">
          <p className="text-xs text-gray-600">Info</p>
          <p className="text-2xl font-bold text-blue-700">{infoAlerts.length}</p>
        </Card>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-8">Chargement des alertes...</p>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="all">Toutes ({filteredAlerts.length})</TabsTrigger>
            <TabsTrigger value="critical">Critiques ({criticalAlerts.length})</TabsTrigger>
            <TabsTrigger value="warning">Warnings ({warningAlerts.length})</TabsTrigger>
            <TabsTrigger value="info">Info ({infoAlerts.length})</TabsTrigger>
          </TabsList>
          {[
            { value: 'all',      items: filteredAlerts },
            { value: 'critical', items: criticalAlerts },
            { value: 'warning',  items: warningAlerts  },
            { value: 'info',     items: infoAlerts     },
          ].map(({ value, items }) => (
            <TabsContent key={value} value={value} className="space-y-2 mt-4">
              {items.length === 0
                ? <p className="text-center text-gray-500 py-8">Aucune alerte</p>
                : items.map((alert) => (
                    <AlertRow key={alert.id} alert={alert} isAdmin={isAdmin}
                      onCreateIntervention={(a) => { setSelectedAlert(a); setModalOpen(true); }} />
                  ))}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <QuickCreateModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedAlert(null); }}
        alert={selectedAlert}
      />
    </div>
  );
}
