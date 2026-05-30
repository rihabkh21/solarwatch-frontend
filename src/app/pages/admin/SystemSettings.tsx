import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Settings, Save, AlertTriangle, Zap, Thermometer, Sun, Wind } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { toast } from 'sonner';

interface ThresholdSetting {
  id: string;
  name: string;
  icon: React.ReactNode;
  min: number;
  max: number;
  unit: string;
  description: string;
}

const defaultThresholds = [
  { id: 'voltage',      name: 'Tension DC',              min: 10,  max: 50,   unit: 'V',    description: 'Plage de tension normale pour les panneaux' },
  { id: 'current',      name: 'Courant DC',              min: 0.5, max: 10,   unit: 'A',    description: 'Plage de courant normale' },
  { id: 'temp_panel',   name: 'Température Panneau',     min: 20,  max: 75,   unit: '°C',   description: 'Température maximale admissible' },
  { id: 'temp_ambient', name: 'Température Ambiante',    min: 15,  max: 45,   unit: '°C',   description: 'Température ambiante normale' },
  { id: 'irradiance',   name: 'Irradiance Solaire',      min: 100, max: 1200, unit: 'W/m²', description: 'Irradiance solaire mesurée' },
  { id: 'efficiency',   name: 'Rendement',               min: 15,  max: 22,   unit: '%',    description: 'Rendement minimal acceptable' },
];

const icons: Record<string, React.ReactNode> = {
  voltage:      <Zap className="h-5 w-5 text-yellow-600" />,
  current:      <Zap className="h-5 w-5 text-blue-600" />,
  temp_panel:   <Thermometer className="h-5 w-5 text-red-600" />,
  temp_ambient: <Thermometer className="h-5 w-5 text-orange-600" />,
  irradiance:   <Sun className="h-5 w-5 text-amber-600" />,
  efficiency:   <Wind className="h-5 w-5 text-green-600" />,
};

export function SystemSettings() {
  const [thresholds, setThresholds] = useState<ThresholdSetting[]>(
    defaultThresholds.map((t) => ({ ...t, icon: icons[t.id] }))
  );
  const [systemConfig, setSystemConfig] = useState({
    updateInterval: 5,
    alertRetention: 30,
    maxAlerts: 1000,
    autoBackup: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Charger settings depuis Firestore ───────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'system'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // Charger les seuils
        if (data.thresholds) {
          setThresholds(
            defaultThresholds.map((t) => ({
              ...t,
              icon: icons[t.id],
              min: data.thresholds[t.id]?.min ?? t.min,
              max: data.thresholds[t.id]?.max ?? t.max,
            }))
          );
        }
        // Charger la config générale
        if (data.updateInterval)   setSystemConfig((prev) => ({ ...prev, updateInterval: data.updateInterval }));
        if (data.alertRetention)   setSystemConfig((prev) => ({ ...prev, alertRetention: data.alertRetention }));
        if (data.maxAlerts)        setSystemConfig((prev) => ({ ...prev, maxAlerts: data.maxAlerts }));
        if (data.autoBackup !== undefined) setSystemConfig((prev) => ({ ...prev, autoBackup: data.autoBackup }));
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleThresholdChange = (id: string, field: 'min' | 'max', value: number) => {
    setThresholds((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  // ── Sauvegarder dans Firestore ──────────────────────────────────────────────
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const thresholdsMap = thresholds.reduce((acc, t) => {
        acc[t.id] = { min: t.min, max: t.max };
        return acc;
      }, {} as Record<string, { min: number; max: number }>);

      await setDoc(doc(db, 'settings', 'system'), {
        thresholds: thresholdsMap,
        updateInterval:  systemConfig.updateInterval,
        alertRetention:  systemConfig.alertRetention,
        maxAlerts:       systemConfig.maxAlerts,
        autoBackup:      systemConfig.autoBackup,
        updatedAt:       new Date().toISOString(),
      }, { merge: true });

      toast.success('Paramètres enregistrés dans Firebase !');
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setThresholds(defaultThresholds.map((t) => ({ ...t, icon: icons[t.id] })));
    toast.success('Seuils réinitialisés — cliquez Enregistrer pour sauvegarder');
  };

  if (loading) return <p className="text-center text-gray-500 py-8">Chargement des paramètres...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Paramètres Système</h1>
          <p className="text-gray-600 mt-1">Configuration des seuils et alertes</p>
        </div>
        <Button
          className="bg-amber-500 hover:bg-amber-600"
          onClick={handleSaveSettings}
          disabled={saving}
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>

      {/* Seuils d'alerte */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-amber-600" />
          <h2 className="text-xl font-semibold text-gray-900">Seuils d'Alerte</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {thresholds.map((threshold) => (
            <Card key={threshold.id} className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-gray-100 rounded-lg">{threshold.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{threshold.name}</h3>
                  <p className="text-sm text-gray-600">{threshold.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Minimum</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={threshold.min}
                      onChange={(e) => handleThresholdChange(threshold.id, 'min', parseFloat(e.target.value))}
                      className="h-9"
                    />
                    <span className="text-sm text-gray-600 whitespace-nowrap">{threshold.unit}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Maximum</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={threshold.max}
                      onChange={(e) => handleThresholdChange(threshold.id, 'max', parseFloat(e.target.value))}
                      className="h-9"
                    />
                    <span className="text-sm text-gray-600 whitespace-nowrap">{threshold.unit}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="absolute h-full bg-green-500" style={{ left: '20%', width: '60%' }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">Min: {threshold.min} {threshold.unit}</span>
                  <span className="text-xs text-gray-500">Max: {threshold.max} {threshold.unit}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Config Générale */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Configuration Générale</h2>
        </div>
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Intervalle de mise à jour (secondes)</Label>
              <Input
                type="number"
                value={systemConfig.updateInterval}
                onChange={(e) => setSystemConfig((prev) => ({ ...prev, updateInterval: parseInt(e.target.value) }))}
              />
              <p className="text-sm text-gray-600">Fréquence de rafraîchissement des données capteurs</p>
            </div>
            <div className="space-y-2">
              <Label>Rétention des alertes (jours)</Label>
              <Input
                type="number"
                value={systemConfig.alertRetention}
                onChange={(e) => setSystemConfig((prev) => ({ ...prev, alertRetention: parseInt(e.target.value) }))}
              />
              <p className="text-sm text-gray-600">Durée de conservation des alertes</p>
            </div>
            <div className="space-y-2">
              <Label>Nombre max d'alertes</Label>
              <Input
                type="number"
                value={systemConfig.maxAlerts}
                onChange={(e) => setSystemConfig((prev) => ({ ...prev, maxAlerts: parseInt(e.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Sauvegarde automatique</Label>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="checkbox"
                  checked={systemConfig.autoBackup}
                  onChange={(e) => setSystemConfig((prev) => ({ ...prev, autoBackup: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Activer les sauvegardes automatiques quotidiennes</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Zone Dangereuse */}
      <Card className="p-6 border-red-200 bg-red-50">
        <h3 className="text-lg font-semibold text-red-900 mb-2">Zone Dangereuse</h3>
        <p className="text-sm text-red-700 mb-4">Les actions suivantes sont irréversibles.</p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100"
            onClick={handleReset}
          >
            Réinitialiser les seuils
          </Button>
        </div>
      </Card>
    </div>
  );
}
