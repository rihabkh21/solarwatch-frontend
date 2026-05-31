import { useState } from 'react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Thermometer, Sun, Zap, Activity } from 'lucide-react';
import { usePanelData } from '../hooks/useSensorData';
import { usePanels } from '../contexts/PanelContext';
import { useAuth } from '../contexts/AuthContext';
import type { SolarPanel } from '../data/mockData';

// Table de correspondance entre la couleur d'un panneau et les classes Tailwind associees
const colorMap: Record<SolarPanel['color'], { bg: string; text: string; border: string; dot: string }> = {
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500'  },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500'  },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  rose:   { bg: 'bg-rose-50',   text: 'text-rose-700',   border: 'border-rose-200',   dot: 'bg-rose-500'   },
};

// Composant de detail d'un panneau : affiche les mesures temps reel de ses quatre capteurs
function PanelView({ panel }: { panel: SolarPanel }) {
  const { sensorData, isLive } = usePanelData(panel, 3000);
  const c = colorMap[panel.color];

  const temp      = sensorData.ds18b20.temperature;
  const lux       = sensorData.bh1750.lux;
  const currentMa = sensorData.acs712.current;           // ✅ déjà en mA, filtré
  const voltage   = sensorData.voltageDivider.voltage;   // ✅ déjà estimé depuis lux
  const power     = sensorData.calculated.power;         // ✅ calculé dans useSensorData

  // Couleur et etiquette de la temperature selon trois seuils : normale, elevee, critique
  const tempColor = temp > 70 ? 'text-red-600' : temp > 55 ? 'text-orange-500' : 'text-green-600';
  const tempLabel = temp > 70 ? 'Critique' : temp > 55 ? 'Élevée' : 'Normale';

  // Etiquette de luminosite selon quatre seuils de lux
  const luxLabel  = lux > 80000 ? 'Plein soleil' : lux > 20000 ? 'Nuageux' : lux > 1000 ? 'Normal' : 'Faible';

  // La tension est estimee (non mesuree) si voltageRaw vaut 0, ce qui indique l'absence de signal ADC
  const voltageEstimated = sensorData.voltageDivider.voltageRaw === 0;

  return (
    <div className="space-y-4">
      {/* Entete du panneau avec nom, localisation et rendement estime */}
      <div className={`rounded-lg ${c.bg} border ${c.border} p-4 flex items-center justify-between`}>
        <div>
          <h2 className={`text-lg font-bold ${c.text}`}>{panel.name}</h2>
          <p className="text-sm text-gray-500">{panel.location}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Rendement estimé</p>
          <p className={`text-xl font-bold ${c.text}`}>{Math.round(panel.efficiencyFactor * 100)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">

        {/* Température */}
        {/* Couleur dynamique selon le seuil : vert < 55°C, orange < 70°C, rouge >= 70°C */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-red-100 rounded">
              <Thermometer className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Température</p>
              <p className="text-xs text-gray-400">DS18B20</p>
            </div>
          </div>
          <p className={`text-3xl font-bold ${tempColor}`}>
            {temp.toFixed(1)}<span className="text-lg">°C</span>
          </p>
          <p className={`text-xs mt-1 ${tempColor}`}>{tempLabel}</p>
        </Card>

        {/* Luminosité */}
        {/* Valeur affichee en kilolux (lux / 1000) pour une meilleure lisibilite */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-yellow-100 rounded">
              <Sun className="h-4 w-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Luminosité</p>
              <p className="text-xs text-gray-400">BH1750</p>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-800">
            {(lux / 1000).toFixed(1)}<span className="text-lg"> klux</span>
          </p>
          <p className="text-xs mt-1 text-gray-400">{luxLabel}</p>
        </Card>

        {/* Tension — estimée depuis lux via useSensorData */}
        {/* Bordure en pointilles orange si la tension est estimee (pas de signal ADC disponible) */}
        <Card className={`p-4 ${voltageEstimated ? 'border-dashed border-orange-300 bg-orange-50' : ''}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-orange-100 rounded">
              <Zap className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Tension</p>
              <p className="text-xs text-gray-400">Pont diviseur</p>
            </div>
          </div>
          <p className="text-3xl font-bold text-orange-500">
            {voltage.toFixed(2)}<span className="text-lg"> V</span>
          </p>
          {/* Indique a l'utilisateur si la valeur est mesuree ou estimee */}
          <p className="text-xs mt-1 text-orange-400">
            {voltageEstimated ? 'Estimée via luminosité' : 'Mesurée'}
          </p>
        </Card>

        {/* Courant en mA — puissance recalculée */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-100 rounded">
              <Activity className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Courant</p>
              <p className="text-xs text-gray-400">ACS712</p>
            </div>
          </div>
          {/* ✅ Affiché en mA (cohérent avec Dashboard) */}
          <p className="text-3xl font-bold text-gray-800">
            {currentMa.toFixed(0)}<span className="text-lg"> mA</span>
          </p>
          {/* Puissance calculee affichee en sous-titre du courant */}
          <p className="text-xs mt-1 text-gray-400">
            Puissance : {power.toFixed(2)} W
          </p>
        </Card>
      </div>

      {/* Tableau recapitulatif de toutes les informations capteurs du panneau */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Informations capteurs</h3>
        <table className="w-full text-sm">
          <tbody className="divide-y">
            <tr>
              <td className="py-2 text-gray-500">DS18B20 — Adresse 1-Wire</td>
              <td className="py-2 font-mono text-xs text-right">{panel.sensors.ds18b20.address}</td>
            </tr>
            <tr>
              <td className="py-2 text-gray-500">BH1750 — Adresse I2C</td>
              <td className="py-2 font-medium text-right">{panel.sensors.bh1750.i2cAddress}</td>
            </tr>
            <tr>
              <td className="py-2 text-gray-500">ACS712 — Modèle</td>
              <td className="py-2 font-medium text-right">{panel.sensors.acs712.model}</td>
            </tr>
            <tr>
              <td className="py-2 text-gray-500">ACS712 — Sensibilité</td>
              <td className="py-2 font-medium text-right">{panel.sensors.acs712.sensitivity} mV/A</td>
            </tr>
            <tr>
              <td className="py-2 text-gray-500">Tension</td>
              <td className="py-2 font-medium text-right text-orange-500">
                {voltage.toFixed(2)} V {voltageEstimated && <span className="text-xs text-orange-300">(estimée)</span>}
              </td>
            </tr>
            <tr>
              <td className="py-2 text-gray-500">Courant</td>
              <td className="py-2 font-medium text-right text-blue-600">
                {currentMa.toFixed(0)} mA
              </td>
            </tr>
            <tr>
              <td className="py-2 text-gray-500">Puissance</td>
              <td className="py-2 font-medium text-right text-blue-600">
                {power.toFixed(2)} W
              </td>
            </tr>
            <tr>
              <td className="py-2 text-gray-500">Énergie produite 24h</td>
              {/* Conversion de Wh en kWh pour affichage dans le tableau */}
              <td className="py-2 font-medium text-right text-green-600">
                {(sensorData.calculated.energy24h / 1000).toFixed(3)} kWh
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function Monitoring() {
  const { getVisiblePanels } = usePanels();
  const { user } = useAuth();
  // Filtre les panneaux selon le role et l'email de l'utilisateur connecte
  const panels = getVisiblePanels(user?.email ?? '', user?.role ?? 'user');
  // Panneau selectionne par defaut : le premier panneau visible ou 'P1'
  const [selectedId, setSelectedId] = useState<string>(panels[0]?.id ?? 'P1');
  const selectedPanel = panels.find((p) => p.id === selectedId) ?? panels[0];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Surveillance</h1>
          <p className="text-sm text-gray-500 mt-1">
            Capteurs : DS18B20 · BH1750 · ACS712
          </p>
        </div>
        <Badge className="bg-green-500 text-white gap-1">
          <span className="h-2 w-2 rounded-full bg-white inline-block" />
          En ligne
        </Badge>
      </div>

      {/* Onglets de selection du panneau a afficher */}
      <div className="flex gap-2 flex-wrap">
        {panels.map((panel) => {
          const c = colorMap[panel.color];
          const active = panel.id === selectedId;
          return (
            <button
              key={panel.id}
              onClick={() => setSelectedId(panel.id)}
              // Style actif : fond colore plein ; style inactif : fond clair avec bordure
              className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                active
                  ? `${c.dot} text-white border-transparent`
                  : `${c.bg} ${c.text} ${c.border} hover:opacity-80`
              }`}
            >
              {panel.id} — {panel.name}
            </button>
          );
        })}
      </div>

      {/* Affiche le detail du panneau selectionne */}
      {selectedPanel && <PanelView panel={selectedPanel} />}
    </div>
  );
}
