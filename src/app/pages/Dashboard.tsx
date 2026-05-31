import { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Zap, Gauge, TrendingUp, DollarSign, Cloud, Thermometer, Sun, Activity, MapPin } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useSensorData, usePanelData } from '../hooks/useSensorData';
import { usePanels } from '../contexts/PanelContext';
import { useAuth } from '../contexts/AuthContext';
import type { SolarPanel } from '../data/mockData';
import { useNavigate } from 'react-router';

// Table de correspondance entre la couleur d'un panneau et les classes Tailwind associees
const colorMap: Record<SolarPanel['color'], { bg: string; text: string; border: string; dot: string }> = {
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-300',  dot: 'bg-amber-500' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-300',   dot: 'bg-blue-500' },
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-300',  dot: 'bg-green-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300', dot: 'bg-purple-500' },
  rose:   { bg: 'bg-rose-50',   text: 'text-rose-700',   border: 'border-rose-300',   dot: 'bg-rose-500' },
};

// Carte miniature d'un panneau affichant ses mesures en temps reel (puissance, tension, temperature, lumiere)
function MiniPanelCard({ panel }: { panel: SolarPanel }) {
  const { sensorData } = usePanelData(panel, 3000);
  const c = colorMap[panel.color];
  const navigate = useNavigate();

  //  Rendement réel depuis Firebase (calculé par Node.js)
  const efficiency = Math.round(sensorData.calculated.efficiency);

  return (
    <Card
      className={`border-2 ${c.border} cursor-pointer hover:shadow-md transition-shadow`}
      // Clic sur la carte redirige vers la page de monitoring detaille
      onClick={() => navigate('/monitoring')}
    >
      <div className={`${c.bg} px-3 py-2 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-md flex items-center justify-center ${c.dot} text-white text-xs font-bold`}>
            {panel.id}
          </div>
          <div>
            <p className={`text-sm font-semibold ${c.text} leading-tight`}>{panel.name}</p>
            <p className="text-xs text-gray-400 flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" />{panel.location}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Indicateur de statut actif avec animation pulse */}
          <div className="h-2 w-2 rounded-full animate-pulse bg-green-500" />
          <span className="text-xs text-gray-500">Actif</span>
        </div>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2 text-xs">
        <div className="space-y-0.5">
          <p className="text-gray-400 flex items-center gap-1"><Zap className="h-3 w-3" /> Puissance</p>
          <p className="font-bold text-gray-800">{sensorData.calculated.power.toFixed(1)} W</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-gray-400 flex items-center gap-1"><Zap className="h-3 w-3" /> Tension</p>
          <p className="font-bold text-gray-800">{sensorData.voltageDivider.voltage.toFixed(1)} V</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-gray-400 flex items-center gap-1"><Thermometer className="h-3 w-3" /> Temp.</p>
          {/* Temperature affichee en rouge si elle depasse le seuil critique de 70°C */}
          <p className={`font-bold ${sensorData.ds18b20.temperature > 70 ? 'text-red-600' : 'text-gray-800'}`}>
            {sensorData.ds18b20.temperature.toFixed(1)} °C
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-gray-400 flex items-center gap-1"><Sun className="h-3 w-3" /> Lumière</p>
          <p className="font-bold text-gray-800">{(sensorData.bh1750.lux / 1000).toFixed(1)} klux</p>
        </div>
        <div className="col-span-2 pt-1 border-t flex items-center justify-between">
          <span className="text-gray-400">Rendement</span>
          {/* ✅ Valeur réelle Firebase au lieu de panel.efficiencyFactor * 100 */}
          <span className={`font-bold ${c.text}`}>
            {efficiency > 0 ? `${efficiency}%` : '—'}
          </span>
        </div>
      </div>
    </Card>
  );
}

export function Dashboard() {
  const { sensorData: currentData } = useSensorData();
  const { user } = useAuth();
  const { getVisiblePanels } = usePanels();
  const [sensorHistory, setSensorHistory] = useState<any[]>([]);

  // Horloge mise a jour toutes les secondes pour l'affichage de l'heure en temps reel
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filtre les panneaux visibles selon le role et l'email de l'utilisateur connecte
  const visiblePanels = getVisiblePanels(user?.email ?? '', user?.role ?? 'user');
  const activePanels  = visiblePanels.filter((p) => p.active);

  // Ecoute en temps reel les 24 dernieres entrees de l'historique Firestore pour le tableau de production
  useEffect(() => {
    const q = query(
      collection(db, 'sensorHistory'),
      orderBy('timestamp', 'desc'),
      limit(24)
    );
    const unsub = onSnapshot(q, (snap) => {
      setSensorHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Calcule les KPI principaux depuis les dernieres donnees capteurs
  const stats = useMemo(() => {
    const power      = currentData.calculated.power;
    const energy24h  = currentData.calculated.energy24h;
    const efficiency = currentData.calculated.efficiency;
    // Revenu calcule selon le tarif STEG de 0.15 TND par kWh
    const revenue    = (energy24h / 1000) * 0.15; // Tarif STEG 0.15 TND/kWh
    return { power, totalEnergy24h: energy24h, efficiency, revenue };
  }, [currentData]);

  // Prepare les donnees du tableau de production :
  // utilise l'historique Firestore si disponible, sinon genere 12 lignes depuis les donnees courantes
  const tableData = useMemo(() => {
    if (sensorHistory.length > 0) {
      // Normalise les champs selon les deux formats possibles (ancien et nouveau ESP32)
      return sensorHistory.map((h) => ({
        timestamp:      h.timestamp?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        calculated:     { power: h.power ?? h.calculated?.power ?? 0 },
        voltageDivider: {
          voltage: h.voltage?.value ?? h.voltage ?? h.voltageDivider?.voltage ?? 0,
        },
        acs712: {
          current: h.current ?? h.acs712?.current ?? h.currentShunt?.current ?? 0,
        },
        ds18b20: {
          temperature: h.temperature ?? h.ds18b20?.temperature ?? 0,
        },
      }));
    }
    // Fallback : 12 entrees simulees espacees de 5 minutes avec les donnees courantes
    return Array.from({ length: 12 }, (_, i) => ({
      timestamp:      new Date(Date.now() - i * 5 * 60 * 1000).toISOString(),
      calculated:     { power: currentData.calculated.power },
      voltageDivider: { voltage: currentData.voltageDivider.voltage },
      acs712:         { current: currentData.acs712.current },
      ds18b20:        { temperature: currentData.ds18b20.temperature },
    }));
  }, [sensorHistory, currentData]);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Surveillance en temps réel</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            {/* Horloge temps reel mise a jour toutes les secondes */}
            <p className="text-xl font-bold text-orange-500">
              {time.toLocaleTimeString('fr-FR')}
            </p>
            <p className="text-xs text-gray-400 capitalize">
              {time.toLocaleDateString('fr-FR', {
                weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
          <Badge variant="outline" className="gap-2 bg-orange-50 text-orange-700 border-orange-200">
            <Cloud className="h-3 w-3" /> Firebase Live
          </Badge>
        </div>
      </div>

      {/* KPI Cards */}
      {/* Quatre indicateurs cles : puissance instantanee, energie 24h, rendement, revenus estimes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Zap className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-xs text-gray-500">Puissance totale</p>
              <p className="text-xl font-bold">{stats.power.toFixed(1)} W</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Gauge className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-xs text-gray-500">Énergie 24h</p>
              {/* Affichage en kWh si superieur a 1000 Wh, sinon en Wh */}
              <p className="text-xl font-bold">
                  {stats.totalEnergy24h >= 1000
                    ? `${(stats.totalEnergy24h / 1000).toFixed(3)} kWh`
                    : `${stats.totalEnergy24h.toFixed(2)} Wh`}
                </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-xs text-gray-500">Rendement</p>
              <p className="text-xl font-bold">{stats.efficiency.toFixed(0)} %</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-xs text-gray-500">Revenus 24h</p>
              <p className="text-xl font-bold">{stats.revenue.toFixed(4)} TND</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Panels Overview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">
            Panneaux Solaires
            <span className="ml-2 text-sm font-normal text-gray-500">
              {activePanels.length} actif{activePanels.length !== 1 ? 's' : ''} / {visiblePanels.length} total
            </span>
          </h3>
          <div className="flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-green-500 animate-pulse" />
            <span className="text-xs text-green-600 font-medium">Temps réel</span>
          </div>
        </div>
        {/* Grille responsive des cartes panneaux : 1 colonne mobile, 2 tablette, 3 desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {activePanels.map((panel) => (
            <MiniPanelCard key={panel.id} panel={panel} />
          ))}
        </div>
        {activePanels.length === 0 && (
          <p className="text-center text-gray-400 py-8">Aucun panneau actif</p>
        )}
      </div>

      {/* Production Table */}
      <Card className="p-5">
        <h3 className="font-semibold mb-1">
          Production (24h) — Panneau P1
          {sensorHistory.length > 0 && (
            <Badge variant="outline" className="ml-2 text-xs bg-green-50 text-green-700">
              ● Firestore
            </Badge>
          )}
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          {sensorHistory.length > 0
            ? `${sensorHistory.length} entrées depuis Firestore`
            : 'En attente de données historiques'}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left">
                <th className="pb-3 font-medium text-gray-600">Heure</th>
                <th className="pb-3 font-medium text-gray-600">Puissance (W)</th>
                <th className="pb-3 font-medium text-gray-600">Tension (V)</th>
                <th className="pb-3 font-medium text-gray-600">Courant ACS712 (mA)</th>
                <th className="pb-3 font-medium text-gray-600">Température °C</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {/* Affiche les 12 premieres entrees du tableau de production */}
              {tableData.slice(0, 12).map((data, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="py-3 text-gray-900">
                    {new Date(data.timestamp).toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 font-medium text-amber-600">{data.calculated.power.toFixed(1)} W</td>
                  <td className="py-3 text-gray-900">{data.voltageDivider.voltage.toFixed(2)} V</td>
                  <td className="py-3 text-gray-900">{data.acs712.current.toFixed(0)} mA</td>
                  <td className="py-3 text-gray-900">{data.ds18b20.temperature.toFixed(1)} °C</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sensor Status Live */}
      {/* Affichage en direct des quatre capteurs principaux de l'ESP32 */}
      <Card className="p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          Capteurs ESP32 — Panneau P1
          <Badge className="bg-green-500 text-white text-xs">
            <Activity className="h-3 w-3 mr-1 animate-pulse" /> Live
          </Badge>
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Température (DS18B20)', value: `${currentData.ds18b20.temperature.toFixed(1)} °C`   },
            { label: 'Luminosité (BH1750)',   value: `${(currentData.bh1750.lux / 1000).toFixed(1)} klux` },
            { label: 'Tension',               value: `${currentData.voltageDivider.voltage.toFixed(2)} V`  },
            { label: 'Courant (ACS712)',       value: `${currentData.acs712.current.toFixed(0)} mA`        },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <div>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="font-bold">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
}
