import { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Brain, Sparkles, AlertTriangle, CheckCircle, RefreshCw,
  Zap, Thermometer, Sun, Activity, X, Info,
  Wrench, ShieldAlert, BarChart3, Cpu, Battery,
  DollarSign, TrendingUp, CircuitBoard, Wifi
} from 'lucide-react';
import { realtimeDb } from '../config/firebase';
import { ref, onValue } from 'firebase/database';

interface SensorData {
  irradiance: number;
  temperature: number;
  voltage: number;
  current: number;
  power: number;
}

interface AnalysisResult {
  classification: {
    prediction: number;
    status: 'normal' | 'fault';
    label: string;
    level: 'info' | 'warning' | 'critical';
    probabilities: { normal: number; fault: number };
  };
  regression: {
    power_predicted_w: number;
    energy_24h_wh: number;
    revenue_24h_tnd: number;
  };
  input: SensorData;
}

// ── Modal INFO ────────────────────────────────────────────────
function InfoModal({ result, onClose, isIndoor }: { result: AnalysisResult; onClose: () => void; isIndoor: boolean }) {
  const isNormal = result.classification.status === 'normal';
  const inp = result.input;

  const recommendations = isNormal ? [
    { icon: <CheckCircle className="h-4 w-4 text-green-500" />, title: 'Système opérationnel',   desc: 'Le panneau fonctionne dans les paramètres normaux.' },
    { icon: <Wrench      className="h-4 w-4 text-amber-500" />, title: 'Maintenance préventive', desc: 'Planifiez un nettoyage tous les 3 mois.' },
    { icon: <Activity    className="h-4 w-4 text-blue-500"  />, title: 'Suivi recommandé',       desc: 'Continuez à surveiller les données en temps réel.' },
    { icon: <Thermometer className="h-4 w-4 text-red-400"   />, title: 'Température normale',   desc: 'Température dans la plage optimale de fonctionnement.' },
  ] : [
    { icon: <AlertTriangle className="h-4 w-4 text-red-500"    />, title: 'Intervention requise',    desc: 'Anomalie détectée. Inspectez le panneau immédiatement.' },
    { icon: <Zap           className="h-4 w-4 text-orange-500" />, title: 'Vérifier les connexions', desc: 'Contrôlez tous les câbles et connecteurs.' },
    { icon: <Sun           className="h-4 w-4 text-yellow-500" />, title: 'Nettoyage urgent',        desc: 'Nettoyez la surface — poussière ou ombre possible.' },
    { icon: <Wrench        className="h-4 w-4 text-gray-500"   />, title: 'Appeler un technicien',   desc: "Si l'anomalie persiste, contactez un technicien." },
    { icon: <CircuitBoard  className="h-4 w-4 text-blue-500"   />, title: "Vérifier l'onduleur",    desc: "Contrôlez l'onduleur et le système de protection." },
  ];

  const features = [
    { name: 'Irradiance',  value: `${(inp?.irradiance  ?? 0).toFixed(0)} lux`,        color: 'text-amber-600',  bg: 'bg-amber-50'   },
    { name: 'Température', value: `${(inp?.temperature ?? 0).toFixed(1)} °C`,         color: 'text-red-600',    bg: 'bg-red-50'     },
    { name: 'Tension',     value: `${(inp?.voltage     ?? 0).toFixed(2)} V`,          color: 'text-blue-600',   bg: 'bg-blue-50'    },
    { name: 'Courant',     value: `${((inp?.current    ?? 0) * 1000).toFixed(0)} mA`, color: 'text-green-600',  bg: 'bg-green-50'   },
    { name: 'Puissance',   value: `${(inp?.power       ?? 0).toFixed(2)} W`,          color: 'text-purple-600', bg: 'bg-purple-50'  },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100">

        {/* Header */}
        <div className={`p-5 rounded-t-2xl flex items-center justify-between border-b ${isNormal ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <div className="flex items-center gap-3">
            {isNormal
              ? <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-green-600" /></div>
              : <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-red-600" /></div>}
            <div>
              <h2 className={`text-lg font-bold ${isNormal ? 'text-green-800' : 'text-red-800'}`}>
                {isNormal ? 'Fonctionnement Normal' : 'Anomalie Détectée'}
              </h2>
              <p className="text-xs text-gray-500">
                {isIndoor
                  ? 'Mode intérieur — ML désactivé (lux < 1000)'
                  : 'XGBoost · 313 678 échantillons · Accuracy 75.92%'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white rounded-lg transition-colors">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Badge intérieur */}
          {isIndoor && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <Sun className="h-4 w-4 text-blue-500" />
              <p className="text-sm text-blue-700">
                Luminosité faible ({inp.irradiance.toFixed(0)} lux) — analyse ML désactivée en intérieur pour éviter les faux positifs.
                Le modèle s'activera automatiquement en extérieur (lux ≥ 1000).
              </p>
            </div>
          )}

          {/* Probabilités */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Probabilités de classification</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-green-100 bg-green-50 p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Fonctionnement normal</p>
                <p className="text-3xl font-bold text-green-600">{result.classification.probabilities.normal}%</p>
                <div className="mt-2 w-full bg-green-100 rounded-full h-1.5">
                  <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${result.classification.probabilities.normal}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">Probabilité de panne</p>
                <p className="text-3xl font-bold text-red-500">{result.classification.probabilities.fault}%</p>
                <div className="mt-2 w-full bg-red-100 rounded-full h-1.5">
                  <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${result.classification.probabilities.fault}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Prévision */}
          <div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-center">
                <Zap className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                <p className="text-xs text-gray-500">Puissance</p>
                <p className="text-lg font-bold text-blue-700">{result.regression.power_predicted_w} W</p>
              </div>
              <div className="rounded-xl border border-purple-100 bg-purple-50 p-3 text-center">
                <Battery className="h-4 w-4 text-purple-500 mx-auto mb-1" />
                <p className="text-xs text-gray-500">Énergie/24h</p>
                <p className="text-lg font-bold text-purple-700">{result.regression.energy_24h_wh} Wh</p>
              </div>
              <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-center">
                <DollarSign className="h-4 w-4 text-green-500 mx-auto mb-1" />
                <p className="text-xs text-gray-500">Revenus/24h</p>
                <p className="text-lg font-bold text-green-700">{result.regression.revenue_24h_tnd} TND</p>
              </div>
            </div>
          </div>

          {/* Features */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Features du modèle</p>
            <div className="grid grid-cols-5 gap-2">
              {features.map((f) => (
                <div key={f.name} className={`rounded-lg border ${f.bg} p-2.5 text-center`}>
                  <p className="text-xs text-gray-400 mb-1">{f.name}</p>
                  <p className={`text-sm font-bold ${f.color}`}>{f.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommandations */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {isNormal ? 'Recommandations' : 'Actions requises'}
            </p>
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${isNormal ? 'bg-gray-50 border-gray-100' : 'bg-red-50 border-red-100'}`}>
                  <div className="mt-0.5">{rec.icon}</div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{rec.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{rec.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={onClose}
              className="px-5 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────
export function AIAnalysis() {
  const [sensorData, setSensorData]   = useState<SensorData | null>(null);
  const [result, setResult]           = useState<AnalysisResult | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [lastUpdate, setLastUpdate]   = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [isIndoor, setIsIndoor]       = useState(false);

  useEffect(() => {
    if (!realtimeDb) return;
    const unsubscribe = onValue(ref(realtimeDb, 'sensors/ESP32_001/current'), (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      const sensors: SensorData = {
        irradiance:  data.lux         ?? 0,
        temperature: data.temperature ?? 0,
        voltage:     data.voltage     ?? 0,
        current:    (data.current     ?? 0) / 1000,
        power:       data.power       ?? 0,
      };
      setSensorData(sensors);
      setLastUpdate(new Date().toLocaleTimeString());
      if (autoRefresh) analyze(sensors);
    });
    return () => unsubscribe();
  }, [autoRefresh]);

  const analyze = async (data?: SensorData) => {
    const input = data || sensorData;
    if (!input) return;

    // ✅ ML désactivé en intérieur (lux < 1000) — évite les faux positifs
    if (input.irradiance < 1000) {
      setIsIndoor(true);
      const powerW   = parseFloat(input.power.toFixed(2));
      const energyWh = parseFloat((powerW * 24).toFixed(1));
      const revenue  = parseFloat(((energyWh / 1000) * 0.15).toFixed(3));
      setResult({
        classification: {
          prediction: 0,
          status: 'normal',
          label: 'Fonctionnement Normal',
          level: 'info',
          probabilities: { normal: 100, fault: 0 },
        },
        regression: {
          power_predicted_w: powerW,
          energy_24h_wh:     energyWh,
          revenue_24h_tnd:   revenue,
        },
        input,
      });
      setError(null);
      setLoading(false);
      setLastUpdate(new Date().toLocaleTimeString());
      return; // ← pas d'appel Flask
    }

    //  Extérieur (lux ≥ 1000) — appel ML Flask normal
    setIsIndoor(false);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error('Erreur API');
      setResult(await response.json());
    } catch {
      setError('API XGBoost non disponible — lancez : python app.py');
    } finally {
      setLoading(false);
    }
  };

  const isNormal = result?.classification.status === 'normal';

  return (
    <div className="space-y-5">

      {showModal && result && (
        <InfoModal result={result} onClose={() => setShowModal(false)} isIndoor={isIndoor} />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analyse IA</h1>
          <p className="text-sm text-gray-500 mt-1">Détection anomalies · Prévision puissance · XGBoost</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              autoRefresh
                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            }`}>
            <Wifi className="h-3 w-3" />
            {autoRefresh ? 'Auto ON' : 'Auto OFF'}
          </button>

          {/* Badge mode intérieur/extérieur */}
          {isIndoor ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs font-medium text-blue-700">
              <Sun className="h-3 w-3" />
              Mode intérieur
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-xs font-medium text-purple-700">
              <Sparkles className="h-3 w-3" />
              XGBoost AI
            </div>
          )}
        </div>
      </div>

      {/* ── Statut principal ── */}
      {result ? (
        <Card className={`p-5 border-l-4 ${isNormal ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${isNormal ? 'bg-green-100' : 'bg-red-100'}`}>
                {isNormal
                  ? <CheckCircle className="h-6 w-6 text-green-600" />
                  : <AlertTriangle className="h-6 w-6 text-red-600" />}
              </div>
              <div>
                <p className={`text-lg font-bold ${isNormal ? 'text-green-800' : 'text-red-800'}`}>
                  {isNormal ? 'Fonctionnement Normal' : 'Anomalie Détectée'}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">
                  {isIndoor ? (
                    <span className="text-blue-600 font-medium">ML désactivé — intérieur ({sensorData?.irradiance?.toFixed(0)} lux)</span>
                  ) : (
                    <>
                      Confiance : <span className="font-semibold">
                        {isNormal ? result.classification.probabilities.normal : result.classification.probabilities.fault}%
                      </span>
                    </>
                  )}
                  <span className="mx-2 text-gray-300">·</span>
                  {lastUpdate && <span>Mise à jour : {lastUpdate}</span>}
                </p>
              </div>
            </div>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50 text-sm font-medium text-gray-700 transition-colors shadow-sm">
              <Info className="h-4 w-4 text-amber-500" />
              Rapport détaillé
            </button>
          </div>

          {/* Barre de confiance */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Normal : {result.classification.probabilities.normal}%</span>
              <span>Panne : {result.classification.probabilities.fault}%</span>
            </div>
            <div className="w-full bg-white rounded-full h-2.5 border border-gray-100">
              <div className="h-2.5 rounded-full transition-all duration-700"
                   style={{
                     width: `${result.classification.probabilities.normal}%`,
                     background: isNormal ? '#22c55e' : '#ef4444'
                   }} />
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-5 border border-dashed border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3 text-gray-400">
            <Brain className="h-6 w-6" />
            <p className="text-sm">En attente de données Firebase pour l'analyse...</p>
          </div>
        </Card>
      )}

      {/* ── Prévisions régression ── */}
      {result && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Zap className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Puissance prévue</p>
                <p className="text-xs text-blue-600 font-medium">{isIndoor ? 'Mesure temps réel' : 'Régression XGBoost'}</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{result.regression.power_predicted_w} <span className="text-sm font-normal text-gray-500">W</span></p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
                <Battery className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Énergie / 24h</p>
                <p className="text-xs text-purple-600 font-medium">Production estimée</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{result.regression.energy_24h_wh} <span className="text-sm font-normal text-gray-500">Wh</span></p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-green-50 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Revenus / 24h</p>
                <p className="text-xs text-green-600 font-medium">0.15 TND/kWh</p>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{result.regression.revenue_24h_tnd} <span className="text-sm font-normal text-gray-500">TND</span></p>
          </Card>
        </div>
      )}

      {/* ── Capteurs temps réel ── */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CircuitBoard className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold text-gray-800">Capteurs ESP32 — Temps réel</p>
          </div>
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            En ligne
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Température', sub: 'DS18B20', value: `${sensorData?.temperature?.toFixed(1) ?? '--'}`, unit: '°C',  icon: <Thermometer className="h-4 w-4 text-red-400" />,    color: 'text-red-600',    bg: 'bg-red-50'    },
            { label: 'Luminosité',  sub: 'BH1750',  value: `${sensorData?.irradiance?.toFixed(0)  ?? '--'}`, unit: ' lux', icon: <Sun         className="h-4 w-4 text-amber-400" />, color: 'text-amber-600',  bg: 'bg-amber-50'  },
            { label: 'Tension',     sub: 'Estimée', value: `${sensorData?.voltage?.toFixed(2)     ?? '--'}`, unit: ' V',   icon: <Zap         className="h-4 w-4 text-blue-400" />,  color: 'text-blue-600',   bg: 'bg-blue-50'   },
            { label: 'Puissance',   sub: 'Calculé', value: `${sensorData?.power?.toFixed(2)       ?? '--'}`, unit: ' W',   icon: <Activity    className="h-4 w-4 text-purple-400"/>, color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map(item => (
            <div key={item.label} className={`rounded-xl ${item.bg} p-3.5 border border-white`}>
              <div className="flex items-center gap-2 mb-2">
                {item.icon}
                <div>
                  <p className="text-xs font-medium text-gray-700">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.sub}</p>
                </div>
              </div>
              <p className={`text-xl font-bold ${item.color}`}>
                {item.value}<span className="text-sm font-normal text-gray-400">{item.unit}</span>
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Erreur API (seulement en extérieur) ── */}
      {error && !isIndoor && (
        <Card className="p-4 bg-orange-50 border border-orange-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-800">{error}</p>
              <p className="text-xs text-orange-600 mt-0.5">Terminal → cd mqtt-bridge\ml → python app.py</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Bouton analyser ── */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Analyser maintenant</p>
              <p className="text-xs text-gray-500">
                {lastUpdate ? `Dernière analyse : ${lastUpdate}` : 'En attente de données...'}
                {isIndoor && <span className="ml-2 text-blue-500">(mode intérieur)</span>}
              </p>
            </div>
          </div>
          <button
            onClick={() => analyze()}
            disabled={loading || !sensorData}
            className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Analyse en cours...' : "Lancer l'analyse"}
          </button>
        </div>
      </Card>

    </div>
  );
}
