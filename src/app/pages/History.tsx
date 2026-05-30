import { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Download, Filter, TrendingUp, TrendingDown, Activity,
  Zap, Sun, Thermometer, X, SlidersHorizontal,
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { toast } from 'sonner';

interface HistoryRow {
  id: string;
  timestamp: string;
  puissance: number;
  tension: number;
  courant: number;
  luminosite: number;
  temperaturePanneau: number;
}

interface Filters {
  capteur: string;
  minVal: string;
  maxVal: string;
  dateFrom: string;
  dateTo: string;
}

const defaultFilters: Filters = {
  capteur: 'tous',
  minVal: '',
  maxVal: '',
  dateFrom: '',
  dateTo: '',
};

export function History() {
  const [timeRange, setTimeRange]   = useState<'24h' | '7d' | '30d' | '90d'>('24h');
  const [rawData, setRawData]       = useState<HistoryRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters]       = useState<Filters>(defaultFilters);
  const [applied, setApplied]       = useState<Filters>(defaultFilters);

  // ── Firestore ──────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const hoursMap = { '24h': 24, '7d': 168, '30d': 720, '90d': 2160 };
    const limitMap = { '24h': 24, '7d': 168, '30d': 300, '90d': 500  };
    const since    = Timestamp.fromDate(new Date(Date.now() - hoursMap[timeRange] * 3600000));

    const q = query(
      collection(db, 'sensorHistory'),
      where('createdAt', '>=', since),
      orderBy('createdAt', 'desc'),
      limit(limitMap[timeRange])
    );

    const unsub = onSnapshot(q, (snap) => {
      const data: HistoryRow[] = snap.docs.map((d) => {
        const h = d.data();
        return {
          id:                 d.id,
          timestamp:          h.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          puissance:          h.power       ?? 0,
          tension:            h.voltage     ?? 0,
          courant:           (h.current     ?? 0) / 1000,
          luminosite:        (h.lux         ?? 0) / 1000,
          temperaturePanneau: h.temperature ?? 0,
        };
      });
      setRawData(data);
      setLoading(false);
    }, (err) => {
      console.error('Erreur sensorHistory:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [timeRange]);

  // ── Stats ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (rawData.length === 0) return { avgEnergy: '0.00', maxPower: '0.00', avgTemp: '0.0', avgLux: '0.0' };
    const powers    = rawData.map((d) => d.puissance);
    const avgEnergy = (powers.reduce((s, p) => s + p, 0) / powers.length / 1000).toFixed(2);
    const maxPower  = (Math.max(...powers) / 1000).toFixed(2);
    const avgTemp   = (rawData.reduce((s, d) => s + d.temperaturePanneau, 0) / rawData.length).toFixed(1);
    const avgLux    = (rawData.reduce((s, d) => s + d.luminosite, 0) / rawData.length).toFixed(1);
    return { avgEnergy, maxPower, avgTemp, avgLux };
  }, [rawData]);

  // ── Filtrage ───────────────────────────────────────────────
  const capteurMap: Record<string, keyof HistoryRow> = {
    puissance:   'puissance',
    tension:     'tension',
    courant:     'courant',
    luminosite:  'luminosite',
    temperature: 'temperaturePanneau',
  };

  const filteredData = useMemo(() => {
    let data = [...rawData];

    // Filtre date
    if (applied.dateFrom) {
      const from = new Date(applied.dateFrom).getTime();
      data = data.filter(d => new Date(d.timestamp).getTime() >= from);
    }
    if (applied.dateTo) {
      const to = new Date(applied.dateTo).getTime();
      data = data.filter(d => new Date(d.timestamp).getTime() <= to);
    }

    // Filtre par valeur capteur
    if (applied.capteur !== 'tous') {
      const field = capteurMap[applied.capteur];
      if (field) {
        if (applied.minVal !== '') {
          data = data.filter(d => (d[field] as number) >= parseFloat(applied.minVal));
        }
        if (applied.maxVal !== '') {
          data = data.filter(d => (d[field] as number) <= parseFloat(applied.maxVal));
        }
      }
    }

    return data;
  }, [rawData, applied]);

  const tableData = useMemo(() => {
    const sampleRate = timeRange === '90d' ? 24 : timeRange === '30d' ? 6 : 1;
    return filteredData.filter((_, i) => i % sampleRate === 0).map((d) => ({
      ...d,
      time: new Date(d.timestamp).toLocaleString('fr-TN', {
        day:    timeRange !== '24h' ? 'numeric' : undefined,
        month:  timeRange !== '24h' ? 'short'   : undefined,
        hour:   '2-digit',
        minute: timeRange === '24h' ? '2-digit' : undefined,
      }),
    }));
  }, [filteredData, timeRange]);

  // ── Export CSV ─────────────────────────────────────────────
  const handleExport = () => {
    if (tableData.length === 0) { toast.error('Aucune donnée à exporter'); return; }
    const header = 'Date/Heure,Puissance(W),Tension(V),Courant(A),Luminosité(klux),Température(°C)';
    const rows   = tableData.map((r) =>
      `${new Date(r.timestamp).toLocaleString('fr-TN')},${r.puissance.toFixed(2)},${r.tension.toFixed(2)},${r.courant.toFixed(3)},${r.luminosite.toFixed(2)},${r.temperaturePanneau.toFixed(1)}`
    );
    const csv  = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `solarwatch-history-${timeRange}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Export CSV — ${tableData.length} entrées`);
  };

  const activeFiltersCount = [
    applied.capteur !== 'tous',
    applied.minVal !== '',
    applied.maxVal !== '',
    applied.dateFrom !== '',
    applied.dateTo !== '',
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Historique des Données</h1>
          <p className="text-gray-500 mt-1">Analyse approfondie des performances historiques</p>
          {!loading && (
            <p className="text-xs text-gray-400 mt-1">
              {rawData.length > 0
               ? `${rawData.length} entrées depuis Firestore`
                : "Aucune donnée pour cette période"}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 heures</SelectItem>
              <SelectItem value="7d">7 jours</SelectItem>
              <SelectItem value="30d">30 jours</SelectItem>
              <SelectItem value="90d">90 jours</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Exporter CSV
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Énergie Moyenne',  value: `${stats.avgEnergy} kW`,  trend: '+8.2%', up: true,  icon: Zap,         bg: 'bg-blue-100',   iconColor: 'text-blue-600'   },
          { label: 'Pic de Puissance', value: `${stats.maxPower} kW`,   trend: '+3.5%', up: true,  icon: Activity,    bg: 'bg-amber-100',  iconColor: 'text-amber-600'  },
          { label: 'Temp. Moyenne',    value: `${stats.avgTemp} °C`,    trend: '-2.1%', up: false, icon: Thermometer, bg: 'bg-red-100',    iconColor: 'text-red-600'    },
          { label: 'Luminosité Moy.',  value: `${stats.avgLux} klux`,   trend: '+5.8%', up: true,  icon: Sun,         bg: 'bg-orange-100', iconColor: 'text-orange-600' },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  {s.up ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-blue-600" />}
                  <span className={`text-sm ${s.up ? 'text-green-600' : 'text-blue-600'}`}>{s.trend}</span>
                </div>
              </div>
              <div className={`h-12 w-12 rounded-full ${s.bg} flex items-center justify-center`}>
                <s.icon className={`h-6 w-6 ${s.iconColor}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Table + Filtre */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            Aperçu des Données Récentes
            {loading && <span className="text-xs text-gray-400 font-normal">Chargement…</span>}
          </h3>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <button
                onClick={() => { setFilters(defaultFilters); setApplied(defaultFilters); }}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">
                <X className="h-3 w-3" />
                Réinitialiser ({activeFiltersCount})
              </button>
            )}
            <Button
              variant="outline" size="sm"
              onClick={() => setShowFilter(v => !v)}
              className={activeFiltersCount > 0 ? 'border-amber-400 text-amber-600 bg-amber-50' : ''}>
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filtrer
              {activeFiltersCount > 0 && (
                <span className="ml-1.5 h-4 w-4 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Panneau filtre */}
        {showFilter && (
          <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Filter className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-semibold text-gray-700">Filtres avancés</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {/* Capteur */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Capteur</label>
                <select
                  value={filters.capteur}
                  onChange={e => setFilters(f => ({ ...f, capteur: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-amber-400">
                  <option value="tous">Tous les capteurs</option>
                  <option value="puissance">Puissance (W)</option>
                  <option value="tension">Tension (V)</option>
                  <option value="courant">Courant (A)</option>
                  <option value="luminosite">Luminosité (klux)</option>
                  <option value="temperature">Température (°C)</option>
                </select>
              </div>

              {/* Min */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Valeur minimum {filters.capteur !== 'tous' ? `(${filters.capteur})` : ''}
                </label>
                <input
                  type="number"
                  value={filters.minVal}
                  onChange={e => setFilters(f => ({ ...f, minVal: e.target.value }))}
                  placeholder="Ex: 0"
                  disabled={filters.capteur === 'tous'}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed" />
              </div>

              {/* Max */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Valeur maximum {filters.capteur !== 'tous' ? `(${filters.capteur})` : ''}
                </label>
                <input
                  type="number"
                  value={filters.maxVal}
                  onChange={e => setFilters(f => ({ ...f, maxVal: e.target.value }))}
                  placeholder="Ex: 100"
                  disabled={filters.capteur === 'tous'}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-amber-400 disabled:opacity-40 disabled:cursor-not-allowed" />
              </div>

              {/* Date début */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Date de début</label>
                <input
                  type="datetime-local"
                  value={filters.dateFrom}
                  onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-amber-400" />
              </div>

              {/* Date fin */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Date de fin</label>
                <input
                  type="datetime-local"
                  value={filters.dateTo}
                  onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-amber-400" />
              </div>

            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setFilters(defaultFilters); setApplied(defaultFilters); }}
                className="px-4 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                Réinitialiser
              </button>
              <button
                onClick={() => { setApplied(filters); setShowFilter(false); toast.success('Filtres appliqués'); }}
                className="px-4 py-1.5 text-sm text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors">
                Appliquer
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <p className="text-center text-gray-400 py-8">Chargement depuis Firestore…</p>
        ) : tableData.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-gray-500 font-medium">Aucune donnée pour ces filtres</p>
            <p className="text-sm text-gray-400">Modifiez les filtres ou élargissez la période.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="pb-3 font-medium text-gray-600">Date/Heure</th>
                  <th className="pb-3 font-medium text-gray-600">Puissance</th>
                  <th className="pb-3 font-medium text-gray-600">Tension</th>
                  <th className="pb-3 font-medium text-gray-600">Courant</th>
                  <th className="pb-3 font-medium text-gray-600">Luminosité</th>
                  <th className="pb-3 font-medium text-gray-600">Température</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tableData.slice(0, 20).map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="py-3 text-gray-900">{row.time}</td>
                    <td className="py-3 font-medium text-amber-600">{row.puissance.toFixed(2)} W</td>
                    <td className="py-3 text-gray-900">{row.tension.toFixed(1)} V</td>
                    <td className="py-3 text-gray-900">{row.courant.toFixed(3)} A</td>
                    <td className="py-3 text-gray-900">{row.luminosite.toFixed(1)} klux</td>
                    <td className="py-3 text-gray-900">{row.temperaturePanneau.toFixed(1)} °C</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tableData.length > 20 && (
              <p className="text-xs text-gray-400 text-center mt-3">
                Affichage de 20 / {tableData.length} entrées — exportez CSV pour tout voir
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
