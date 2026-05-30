import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Sun, Plus, Pencil, Trash2, AlertTriangle,
  Thermometer, Zap, Activity, MapPin, Calendar, Cpu,
  ToggleLeft, ToggleRight, Lightbulb,
} from 'lucide-react';
import { usePanels, AVAILABLE_ADC_PINS, BH1750_ADDRESSES } from '../../contexts/PanelContext';
import type { SolarPanel } from '../../data/mockData';
import { toast } from 'sonner';

// ─── Colors ───────────────────────────────────────────────────────────────────

const colorMap: Record<SolarPanel['color'], { bg: string; text: string; border: string; dot: string }> = {
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-300',  dot: 'bg-amber-500'  },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-300',   dot: 'bg-blue-500'   },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-300',  dot: 'bg-green-500'  },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300', dot: 'bg-purple-500' },
  rose:   { bg: 'bg-rose-50',   text: 'text-rose-700',   border: 'border-rose-300',   dot: 'bg-rose-500'   },
};

// ─── Default form ─────────────────────────────────────────────────────────────

const defaultForm = (): Omit<SolarPanel, 'id' | 'color'> => ({
  name: '',
  location: '',
  active: true,
  efficiencyFactor: 1.0,
  tempOffset: 0,
  sensors: {
    ds18b20:        { address: '', gpioPin: 4 },
    bh1750:         { i2cAddress: '0x23', sdaPin: 21, sclPin: 22 },
    voltageDivider: { adcPin: 34, r1: '30kΩ', r2: '10kΩ' },
    acs712:         { adcPin: 35, sensitivity: 185, model: 'ACS712-05B' },
  },
  specs: { nominalVoltage: '6V', maxVoltage: '12V', estimatedPower: '10W', type: 'Mini panneau solaire' },
  installDate: new Date().toISOString().split('T')[0],
});

// ─── Panel Form Dialog ─────────────────────────────────────────────────────────

function PanelFormDialog({ open, onClose, editPanel }: {
  open: boolean; onClose: () => void; editPanel?: SolarPanel;
}) {
  const { addPanel, updatePanel, panels } = usePanels();
  const [form, setForm] = useState<Omit<SolarPanel, 'id' | 'color'>>(
    editPanel ? { ...editPanel } : defaultForm()
  );

  const usedVoltagePins = panels.filter((p) => p.id !== editPanel?.id).map((p) => p.sensors.voltageDivider.adcPin);
  const usedCurrentPins = panels.filter((p) => p.id !== editPanel?.id).map((p) => p.sensors.acs712?.adcPin ?? 35);
  const hasVoltageConflict = usedVoltagePins.includes(form.sensors.voltageDivider.adcPin);
  const hasCurrentConflict = usedCurrentPins.includes(form.sensors.acs712?.adcPin ?? 35);
  const hasPinConflict = hasVoltageConflict || hasCurrentConflict ||
    form.sensors.voltageDivider.adcPin === (form.sensors.acs712?.adcPin ?? 35);

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('Le nom est obligatoire'); return; }
    if (!form.sensors.ds18b20.address.trim()) { toast.error("L'adresse DS18B20 est obligatoire"); return; }
    if (hasPinConflict) { toast.error('Conflit de pins GPIO détecté !'); return; }
    if (editPanel) { updatePanel(editPanel.id, form); toast.success(`Panneau ${editPanel.id} mis à jour`); }
    else { addPanel(form); toast.success('Nouveau panneau ajouté'); }
    onClose();
  };

  const setNested = (path: string, value: unknown) => {
    const keys = path.split('.');
    setForm((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      let obj: Record<string, unknown> = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]] as Record<string, unknown>;
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-amber-500" />
            {editPanel ? `Modifier — ${editPanel.id} ${editPanel.name}` : 'Ajouter un panneau solaire'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Infos générales */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Informations générales</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Nom du panneau *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex : Panneau Toit Sud" />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Emplacement</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Ex : Toit, exposition Sud" />
              </div>
              <div className="space-y-1.5">
                <Label>Facteur de rendement (0–1)</Label>
                <Input type="number" min="0" max="1" step="0.01" value={form.efficiencyFactor}
                  onChange={(e) => setForm({ ...form, efficiencyFactor: parseFloat(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Date d'installation</Label>
                <Input type="date" value={form.installDate}
                  onChange={(e) => setForm({ ...form, installDate: e.target.value })} />
              </div>
            </div>
          </div>

          <Separator />

          {/* DS18B20 */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-red-600">
              <Thermometer className="h-3.5 w-3.5" /> DS18B20 — Adresse 1-Wire *
            </Label>
            <Input value={form.sensors.ds18b20.address}
              onChange={(e) => setNested('sensors.ds18b20.address', e.target.value)}
              placeholder="28:FF:64:0C:80:16:03:5C" className="font-mono text-sm" />
          </div>

          {/* BH1750 */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-yellow-600">
              <Lightbulb className="h-3.5 w-3.5" /> BH1750 — Adresse I2C
            </Label>
            <Select value={form.sensors.bh1750.i2cAddress}
              onValueChange={(v) => setNested('sensors.bh1750.i2cAddress', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BH1750_ADDRESSES.map((addr) => <SelectItem key={addr} value={addr}>{addr}</SelectItem>)}
              </SelectContent>
            </Select>
            {form.sensors.bh1750.i2cAddress === 'Mux TCA9548A' && (
              <div className="space-y-1.5 mt-2">
                <Label>Canal multiplexeur (0–7)</Label>
                <Input type="number" min="0" max="7" value={form.sensors.bh1750.channel ?? 0}
                  onChange={(e) => setNested('sensors.bh1750.channel', parseInt(e.target.value))} />
              </div>
            )}
          </div>

          {/* GPIO ADC */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-purple-600">
                <Zap className="h-3.5 w-3.5" /> Pin Tension (ADC)
                {hasVoltageConflict && <AlertTriangle className="h-3 w-3 text-red-500" />}
              </Label>
              <Select value={String(form.sensors.voltageDivider.adcPin)}
                onValueChange={(v) => setNested('sensors.voltageDivider.adcPin', parseInt(v))}>
                <SelectTrigger className={hasVoltageConflict ? 'border-red-400' : ''}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ADC_PINS.map((pin) => (
                    <SelectItem key={pin} value={String(pin)}>
                      GPIO {pin}{(usedVoltagePins.includes(pin) || usedCurrentPins.includes(pin)) ? ' ⚠️' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-blue-600">
                <Activity className="h-3.5 w-3.5" /> Pin ACS712 (ADC)
                {hasCurrentConflict && <AlertTriangle className="h-3 w-3 text-red-500" />}
              </Label>
              <Select value={String(form.sensors.acs712?.adcPin ?? 35)}
                onValueChange={(v) => setNested('sensors.acs712.adcPin', parseInt(v))}>
                <SelectTrigger className={hasCurrentConflict ? 'border-red-400' : ''}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ADC_PINS.map((pin) => (
                    <SelectItem key={pin} value={String(pin)}>
                      GPIO {pin}{(usedVoltagePins.includes(pin) || usedCurrentPins.includes(pin)) ? ' ⚠️' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasPinConflict && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 flex items-center gap-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Conflit GPIO — deux panneaux ne peuvent pas partager le même pin ADC.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={hasPinConflict || !form.name.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-white">
            <Sun className="h-4 w-4 mr-2" />
            {editPanel ? 'Mettre à jour' : 'Ajouter le panneau'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Panel Card ───────────────────────────────────────────────────────────────

function PanelCard({ panel, onEdit, onDelete, onToggle }: {
  panel: SolarPanel; onEdit: () => void; onDelete: () => void; onToggle: () => void;
}) {
  const c = colorMap[panel.color];

  return (
    <Card className={`border-2 ${c.border} overflow-hidden`}>
      {/* Header */}
      <div className={`${c.bg} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${c.dot} text-white font-bold text-sm`}>
            {panel.id}
          </div>
          <div>
            <p className={`font-semibold ${c.text}`}>{panel.name}</p>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5" /> {panel.location}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={panel.active
          ? 'bg-green-100 text-green-700 border-green-300'
          : 'bg-gray-100 text-gray-500 border-gray-300'}>
          {panel.active ? '● Actif' : '○ Inactif'}
        </Badge>
      </div>

      {/* Capteurs — 3 badges simples */}
      <div className="px-4 py-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-red-50 p-2.5 text-center">
          <Thermometer className="h-4 w-4 text-red-500 mx-auto mb-1" />
          <p className="font-semibold text-red-600">DS18B20</p>
          <p className="text-gray-400">Température</p>
        </div>
        <div className="rounded-lg bg-yellow-50 p-2.5 text-center">
          <Lightbulb className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
          <p className="font-semibold text-yellow-600">BH1750</p>
          <p className="text-gray-400">Luminosité</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-2.5 text-center">
          <Activity className="h-4 w-4 text-blue-500 mx-auto mb-1" />
          <p className="font-semibold text-blue-600">ACS712</p>
          <p className="text-gray-400">Courant</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 flex items-center justify-between border-t pt-2">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(panel.installDate).toLocaleDateString('fr-TN')}
          <span className="mx-1 text-gray-300">·</span>
          <Cpu className="h-3 w-3" />
          {Math.round(panel.efficiencyFactor * 100)}%
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={onEdit}>
            <Pencil className="h-3 w-3" /> Modifier
          </Button>
          <Button size="sm" variant="outline"
            className={`text-xs gap-1 ${panel.active ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'}`}
            onClick={onToggle}>
            {panel.active
              ? <><ToggleRight className="h-3 w-3" /> Désactiver</>
              : <><ToggleLeft className="h-3 w-3" /> Activer</>}
          </Button>
          <Button size="sm" variant="outline"
            className="text-red-600 hover:bg-red-50 hover:border-red-300"
            onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PanelManagement() {
  const { panels, deletePanel, togglePanel, getConflicts } = usePanels();
  const [formOpen, setFormOpen]     = useState(false);
  const [editTarget, setEditTarget] = useState<SolarPanel | undefined>(undefined);
  const conflicts = getConflicts();

  const handleEdit   = (panel: SolarPanel) => { setEditTarget(panel); setFormOpen(true); };
  const handleDelete = (panel: SolarPanel) => {
    if (panels.length <= 1) { toast.error('Au moins un panneau est requis'); return; }
    deletePanel(panel.id);
    toast.success(`Panneau ${panel.id} supprimé`);
  };
  const handleToggle = (panel: SolarPanel) => {
    togglePanel(panel.id);
    toast.success(`Panneau ${panel.id} ${panel.active ? 'désactivé' : 'activé'}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Panneaux</h1>
          <p className="text-sm text-gray-500 mt-1">
            Capteurs : DS18B20 · BH1750 · ACS712
          </p>
        </div>
        <Button onClick={() => { setEditTarget(undefined); setFormOpen(true); }}
          className="bg-amber-500 hover:bg-amber-600 text-white shrink-0">
          <Plus className="h-4 w-4 mr-2" /> Ajouter un panneau
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 bg-amber-50 border-amber-200">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold text-amber-700">{panels.length}</p>
        </Card>
        <Card className="p-3 bg-green-50 border-green-200">
          <p className="text-xs text-gray-500">Actifs</p>
          <p className="text-2xl font-bold text-green-700">{panels.filter((p) => p.active).length}</p>
        </Card>
        <Card className="p-3 bg-blue-50 border-blue-200">
          <p className="text-xs text-gray-500">Capteurs</p>
          <p className="text-2xl font-bold text-blue-700">{panels.length * 3}</p>
        </Card>
        
      </div>

      {/* Conflits */}
      {conflicts.length > 0 && (
        <Card className="p-4 bg-red-50 border-red-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Conflits GPIO détectés !</p>
              <ul className="mt-2 space-y-1">
                {conflicts.map((c) => (
                  <li key={c.pin} className="text-sm text-red-700">
                    • GPIO {c.pin} utilisé par : {c.panels.join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Panneaux */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {panels.map((panel) => (
          <PanelCard key={panel.id} panel={panel}
            onEdit={() => handleEdit(panel)}
            onDelete={() => handleDelete(panel)}
            onToggle={() => handleToggle(panel)}
          />
        ))}
      </div>

      <PanelFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(undefined); }}
        editPanel={editTarget}
      />
    </div>
  );
}
