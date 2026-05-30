import { useState } from 'react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Cpu, Zap, Thermometer, Sun, Wifi, CircuitBoard,
  Cable, Battery, Plug, Plus, Trash2, Activity,
} from 'lucide-react';
import { hardwareSpecs } from '../../data/mockData';
import { usePanels } from '../../contexts/PanelContext';
import type { SolarPanel } from '../../data/mockData';

// ─── Color helpers ─────────────────────────────────────────────────────────────

const colorDot: Record<SolarPanel['color'], string> = {
  amber:  'bg-amber-500',
  blue:   'bg-blue-500',
  green:  'bg-green-500',
  purple: 'bg-purple-500',
  rose:   'bg-rose-500',
};
const colorBg: Record<SolarPanel['color'], string> = {
  amber:  'bg-amber-50',
  blue:   'bg-blue-50',
  green:  'bg-green-50',
  purple: 'bg-purple-50',
  rose:   'bg-rose-50',
};
const colorBorder: Record<SolarPanel['color'], string> = {
  amber:  'border-amber-300',
  blue:   'border-blue-300',
  green:  'border-green-300',
  purple: 'border-purple-300',
  rose:   'border-rose-300',
};
const colorText: Record<SolarPanel['color'], string> = {
  amber:  'text-amber-700',
  blue:   'text-blue-700',
  green:  'text-green-700',
  purple: 'text-purple-700',
  rose:   'text-rose-700',
};

// ─── Row helper ────────────────────────────────────────────────────────────────

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`font-medium text-gray-900 text-xs text-right max-w-[55%] ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Panel Sensor Card ─────────────────────────────────────────────────────────

function PanelSensorsView({ panel }: { panel: SolarPanel }) {
  // Fallback pour les anciens panneaux Firestore sans acs712
  const acs712 = panel.sensors?.acs712 ?? { adcPin: 35, sensitivity: 185, model: 'ACS712-05B' };

  return (
    <div className="space-y-4">
      {/* Panel header */}
      <div className={`rounded-xl ${colorBg[panel.color]} border-2 ${colorBorder[panel.color]} p-4`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorDot[panel.color]} text-white font-bold`}>
            {panel.id}
          </div>
          <div>
            <p className={`font-bold ${colorText[panel.color]}`}>{panel.name}</p>
            <p className="text-sm text-gray-500">{panel.location}</p>
          </div>
          <Badge variant="outline" className={`ml-auto text-xs ${colorBorder[panel.color]} ${colorText[panel.color]}`}>
            {panel.active ? '● Actif' : '○ Inactif'}
          </Badge>
        </div>
      </div>

      {/* Sensor grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* DS18B20 */}
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2.5 bg-red-100 rounded-lg">
              <Thermometer className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900">DS18B20</h3>
                <Badge variant="outline" className="text-xs">1-Wire</Badge>
              </div>
              <p className="text-xs text-gray-500">Capteur de température numérique</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <Row label="GPIO Pin"           value={`GPIO ${panel.sensors.ds18b20.gpioPin} (bus partagé)`} />
            <Row label="Adresse 1-Wire"     value={panel.sensors.ds18b20.address} mono />
            <Row label="Plage mesure"       value="-55°C à +125°C" />
            <Row label="Précision"          value="±0.5°C" />
            <Row label="Résistance pull-up" value="4.7 kΩ (vers 3.3V)" />
          </div>
        </Card>

        {/* BH1750 */}
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2.5 bg-yellow-100 rounded-lg">
              <Sun className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900">BH1750</h3>
                <Badge variant="outline" className="text-xs">I2C</Badge>
              </div>
              <p className="text-xs text-gray-500">Capteur de luminosité ambiant</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <Row label="Adresse I2C"  value={panel.sensors.bh1750.i2cAddress} mono />
            {panel.sensors.bh1750.channel !== undefined && (
              <Row label="Canal Mux"  value={`TCA9548A — Canal ${panel.sensors.bh1750.channel}`} />
            )}
            <Row label="SDA (GPIO)"   value={`GPIO ${panel.sensors.bh1750.sdaPin}`} />
            <Row label="SCL (GPIO)"   value={`GPIO ${panel.sensors.bh1750.sclPin}`} />
            <Row label="Plage mesure" value="1 – 65535 lux" />
            <Row label="Résolution"   value="1 lux" />
          </div>
        </Card>

        {/* Pont Diviseur */}
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2.5 bg-purple-100 rounded-lg">
              <Cable className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900">Pont Diviseur</h3>
                <Badge variant="outline" className="text-xs">ADC</Badge>
              </div>
              <p className="text-xs text-gray-500">Mesure tension panneau</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <Row label="Pin ADC"        value={`GPIO ${panel.sensors.voltageDivider.adcPin} (dédié)`} />
            <Row label="R1 (vers IN)"   value={panel.sensors.voltageDivider.r1} />
            <Row label="R2 (vers GND)"  value={panel.sensors.voltageDivider.r2} />
            <Row label="Ratio diviseur" value="4:1 (40kΩ / 10kΩ)" />
            <Row label="Plage tension"  value="0 – 13.2V → 0 – 3.3V" />
            <Row label="Résolution ADC" value="12 bits (0–4095)" />
          </div>
        </Card>

        {/* ACS712 — remplace currentShunt */}
        <Card className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2.5 bg-blue-100 rounded-lg">
              <Zap className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900">ACS712</h3>
                <Badge variant="outline" className="text-xs">Analogique</Badge>
              </div>
              <p className="text-xs text-gray-500">Capteur de courant à effet Hall</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <Row label="Modèle"        value={acs712.model} />
            <Row label="Pin ADC"       value={`GPIO ${acs712.adcPin} (dédié)`} />
            <Row label="Sensibilité"   value={`${acs712.sensitivity} mV/A`} />
            <Row label="Tension repos" value="2500 mV (Vcc/2)" />
            <Row label="Plage courant" value="±5A (ACS712-05B)" />
            <Row label="Formule"       value="I = (Vout - 2500) / 185" mono />
          </div>
        </Card>
      </div>

      {/* Specs panneau */}
      <Card className="p-4 bg-amber-50 border-amber-200">
        <div className="flex items-center gap-3">
          <Battery className="h-5 w-5 text-amber-600" />
          <div>
            <p className="font-semibold text-gray-900 text-sm">Spécifications panneau</p>
            <p className="text-xs text-gray-500">{panel.specs.type}</p>
          </div>
          <div className="ml-auto flex gap-6 text-sm flex-wrap">
            <div><span className="text-gray-400">Tension nominale : </span><b>{panel.specs.nominalVoltage}</b></div>
            <div><span className="text-gray-400">Max : </span><b>{panel.specs.maxVoltage}</b></div>
            <div><span className="text-gray-400">Puissance est. : </span><b>{panel.specs.estimatedPower}</b></div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function HardwareConfig() {
  const { panels } = usePanels();
  const [selectedPanelId, setSelectedPanelId] = useState<string>(panels[0]?.id ?? '');
  const [customHardware, setCustomHardware]   = useState<Array<{ id: string; name: string; type: string; specs: string }>>([]);
  const [newHardware, setNewHardware]         = useState({ name: '', type: '', specs: '' });

  const selectedPanel = panels.find((p) => p.id === selectedPanelId) ?? panels[0];

  const addHardware = () => {
    if (newHardware.name && newHardware.type && newHardware.specs) {
      setCustomHardware([...customHardware, { id: Date.now().toString(), ...newHardware }]);
      setNewHardware({ name: '', type: '', specs: '' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <CircuitBoard className="h-7 w-7 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuration Matérielle</h1>
          <p className="text-sm text-gray-500 mt-0.5">ESP32-WROOM-32U + capteurs par panneau</p>
        </div>
      </div>

      {/* ESP32 */}
      <Card className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-600 rounded-xl">
            <Cpu className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="font-bold text-gray-900 text-lg">{hardwareSpecs.microcontroller.model}</h2>
              <Badge variant="outline" className="bg-white text-xs">Contrôleur central</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mt-3">
              <div><p className="text-gray-400 text-xs">Puce</p><p className="font-semibold">{hardwareSpecs.microcontroller.chip}</p></div>
              <div><p className="text-gray-400 text-xs">Fréquence</p><p className="font-semibold">{hardwareSpecs.microcontroller.frequency}</p></div>
              <div><p className="text-gray-400 text-xs">Flash</p><p className="font-semibold">{hardwareSpecs.microcontroller.flash}</p></div>
              <div><p className="text-gray-400 text-xs">GPIO</p><p className="font-semibold">{hardwareSpecs.microcontroller.gpio} pins</p></div>
            </div>
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Wifi className="h-3.5 w-3.5" /> {hardwareSpecs.microcontroller.wifi}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Activity className="h-3.5 w-3.5" /> {panels.filter(p => p.active).length} panneau(x) actif(s)
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Zap className="h-3.5 w-3.5" /> ADC {hardwareSpecs.microcontroller.adc}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Panel Selector */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Sélectionner un panneau :</p>
        <div className="flex items-center gap-2 flex-wrap border-b pb-3">
          {panels.map((panel) => {
            const isActive = panel.id === selectedPanelId;
            return (
              <button
                key={panel.id}
                onClick={() => setSelectedPanelId(panel.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg border-2 text-sm font-medium transition-all ${
                  isActive
                    ? `${colorBg[panel.color]} ${colorBorder[panel.color]} ${colorText[panel.color]}`
                    : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${colorDot[panel.color]}`} />
                <span>{panel.id}</span>
                <span className="hidden sm:inline">{panel.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Per-panel sensors */}
      {selectedPanel && <PanelSensorsView panel={selectedPanel} />}

      {/* Custom Hardware */}
      <Card className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-green-600" />
          Matériel Supplémentaire
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div className="space-y-1.5">
            <Label htmlFor="hw-name">Nom du composant</Label>
            <Input id="hw-name" placeholder="Ex: TCA9548A Mux" value={newHardware.name} onChange={(e) => setNewHardware({ ...newHardware, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hw-type">Type</Label>
            <Input id="hw-type" placeholder="Ex: Multiplexeur I2C" value={newHardware.type} onChange={(e) => setNewHardware({ ...newHardware, type: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hw-specs">Spécifications</Label>
            <Input id="hw-specs" placeholder="Ex: I2C 0x70, 8 canaux" value={newHardware.specs} onChange={(e) => setNewHardware({ ...newHardware, specs: e.target.value })} />
          </div>
        </div>
        <Button onClick={addHardware} className="bg-green-600 hover:bg-green-700 text-white">
          <Plus className="h-4 w-4 mr-2" /> Ajouter
        </Button>
      </Card>

      {customHardware.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Matériel Personnalisé</h2>
          <div className="space-y-2">
            {customHardware.map((hw) => (
              <div key={hw.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{hw.name}</p>
                  <p className="text-xs text-gray-500">{hw.type} — {hw.specs}</p>
                </div>
                <Button
                  variant="outline" size="sm"
                  className="text-red-600 hover:bg-red-50 border-red-200"
                  onClick={() => setCustomHardware(customHardware.filter((h) => h.id !== hw.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
