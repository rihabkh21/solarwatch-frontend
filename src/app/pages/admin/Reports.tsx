import { useState, useEffect, useMemo } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  FileText, Download, Calendar, TrendingUp, AlertCircle,
  DollarSign, Zap, BarChart3, Sun, CheckSquare, Square,
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { db, realtimeDb } from '../../config/firebase';
import { formatShortDate } from '../../utils/dateTime';
import { toast } from 'sonner';
import { usePanels } from '../../contexts/PanelContext';
import type { SolarPanel } from '../../data/mockData';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Color helpers ─────────────────────────────────────────────────────────────

const colorDot: Record<SolarPanel['color'], string> = {
  amber: 'bg-amber-500', blue: 'bg-blue-500', green: 'bg-green-500',
  purple: 'bg-purple-500', rose: 'bg-rose-500',
};
const colorBorder: Record<SolarPanel['color'], string> = {
  amber: 'border-amber-300', blue: 'border-blue-300', green: 'border-green-300',
  purple: 'border-purple-300', rose: 'border-rose-300',
};
const colorText: Record<SolarPanel['color'], string> = {
  amber: 'text-amber-700', blue: 'text-blue-700', green: 'text-green-700',
  purple: 'text-purple-700', rose: 'text-rose-700',
};

const TARIF_TND_KWH = 0.15; // Tarif STEG réel

const reportTypes = [
  { id: 'daily',       name: 'Rapport Quotidien',      description: 'Production et performance du jour',  icon: Calendar,    color: 'text-blue-600',   bgColor: 'bg-blue-50'   },
  { id: 'weekly',      name: 'Rapport Hebdomadaire',   description: 'Analyse de la semaine écoulée',      icon: BarChart3,   color: 'text-green-600',  bgColor: 'bg-green-50'  },
  { id: 'monthly',     name: 'Rapport Mensuel',        description: 'Performance mensuelle complète',     icon: TrendingUp,  color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { id: 'alerts',      name: "Rapport d'Alertes",      description: 'Historique des incidents et pannes', icon: AlertCircle, color: 'text-red-600',    bgColor: 'bg-red-50'    },
  { id: 'revenue',     name: 'Rapport Financier',      description: 'Revenus et économies en TND',        icon: DollarSign,  color: 'text-amber-600',  bgColor: 'bg-amber-50'  },
  { id: 'performance', name: 'Rapport de Performance', description: 'Efficacité des panneaux solaires',   icon: Zap,         color: 'text-orange-600', bgColor: 'bg-orange-50' },
];

// ─── Helpers PDF / CSV ─────────────────────────────────────────────────────────

function genererPDF(
  titre: string,
  sousTitre: string,
  colonnes: string[],
  lignes: (string | number)[][],
  nomFichier: string,
) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(titre, 14, 18);
  doc.setFontSize(10);
  doc.text(sousTitre, 14, 26);
  doc.text('Généré le : ' + new Date().toLocaleDateString('fr-TN'), 14, 33);
  autoTable(doc, { head: [colonnes], body: lignes, startY: 40 });
  doc.save(nomFichier + '.pdf');
}

function genererCSV(
  colonnes: string[],
  lignes: (string | number)[][],
  nomFichier: string,
) {
  const csv = [colonnes.join(','), ...lignes.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Panel Selector ────────────────────────────────────────────────────────────

function PanelSelector({ panels, selected, onChange }: {
  panels: SolarPanel[]; selected: string[]; onChange: (ids: string[]) => void;
}) {
  const allSelected = selected.length === panels.length;
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      if (selected.length === 1) return;
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => onChange(allSelected ? [panels[0]?.id] : panels.map((p) => p.id))}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
          allSelected ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
        }`}
      >
        {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        Tous
      </button>
      {panels.map((panel) => {
        const isSelected = selected.includes(panel.id);
        return (
          <button
            key={panel.id}
            onClick={() => toggle(panel.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
              isSelected
                ? `${colorDot[panel.color]} text-white border-transparent`
                : `bg-white ${colorText[panel.color]} ${colorBorder[panel.color]} hover:opacity-80`
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isSelected ? 'bg-white' : colorDot[panel.color]}`} />
            {panel.id}
            <span className="hidden sm:inline text-xs opacity-80">{panel.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function Reports() {
  const { panels } = usePanels();
  const [selectedPanels, setSelectedPanels] = useState<string[]>([]);
  const [sensorHistory, setSensorHistory] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [rtdbCurrent, setRtdbCurrent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Init selectedPanels quand panels chargés
  useEffect(() => {
    if (panels.length > 0 && selectedPanels.length === 0) {
      setSelectedPanels(panels.map((p) => p.id));
    }
  }, [panels]);

  // ── Charger sensorHistory depuis Firestore ──────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'sensorHistory'),
      orderBy('timestamp', 'desc'),
      limit(500)
    );
    const unsub = onSnapshot(q, (snap) => {
      setSensorHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Charger alertes depuis Firestore ────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'alerts'), (snap) => {
      setAlerts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // ── Lire données live depuis RTDB (energy24h, efficiency réels) ─────────────
  useEffect(() => {
    if (!realtimeDb) return;
    const dbRef = ref(realtimeDb, 'sensors/ESP32_001/current');
    const unsub = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) setRtdbCurrent(snapshot.val());
    });
    return () => unsub();
  }, []);

  // ── Calculer les stats par panneau depuis Firebase uniquement ───────────────
  const panelStats = useMemo(() => {
    const stats: Record<string, { production: number; revenue: number; efficiency: number; alerts: number }> = {};

    panels.forEach((p) => {
      //  Entrées valides uniquement — ignorer les vieilles entrées nulles (avant correction Node.js)
      const history = sensorHistory.filter(
        (h) =>
          (h.deviceId === `ESP32_${p.id}` || h.deviceId === 'ESP32_001') &&
          ((h.energy24h ?? 0) > 0 || (h.efficiency ?? 0) > 0 || (h.power ?? 0) > 0)
      );

      //  Lire depuis RTDB (données live) — plus fiable que Firestore pour les stats
      // energy24h dans RTDB est en Wh (ex: 0.0060 Wh)
      const rtdbEnergy = rtdbCurrent?.energy24h  ?? 0;
      const rtdbEffic  = rtdbCurrent?.efficiency ?? 0;
      const rtdbPower  = rtdbCurrent?.power      ?? 0;

      // Fallback Firestore si RTDB indispo
      const fsMaxEnergy = history.reduce((max, h) => {
        const e = h.energy24h ?? h.calculated?.energy24h ?? 0;
        return e > max ? e : max;
      }, 0);
      const fsEffic = history.length > 0
        ? history.reduce((sum, h) => sum + (h.efficiency ?? h.calculated?.efficiency ?? 0), 0) / history.length
        : 0;

      //  Production : RTDB en priorité, Firestore en fallback
      const productionWh  = rtdbEnergy > 0 ? rtdbEnergy : fsMaxEnergy;

      //  Revenus = production (Wh) / 1000 × tarif TND/kWh
      const revenueReal = parseFloat(((productionWh / 1000) * TARIF_TND_KWH).toFixed(6));

      //  Efficacité : RTDB en priorité
      const efficiencyValues = history
        .map((h) => h.efficiency ?? h.calculated?.efficiency ?? 0)
        .filter((e) => e > 0);
      const efficiencyAvg = rtdbEffic > 0 ? rtdbEffic
        : efficiencyValues.length > 0
          ? efficiencyValues.reduce((s, e) => s + e, 0) / efficiencyValues.length
          : 0;

      //  Alertes réelles depuis Firestore
      const panelAlerts = alerts.filter(
        (a) => a.sensorData?.panelId === p.id || a.deviceId === 'ESP32_001'
      ).length;

      stats[p.id] = {
        production: parseFloat(productionWh.toFixed(2)),
        revenue:    revenueReal,
        efficiency: parseFloat(efficiencyAvg.toFixed(1)),
        alerts:     panelAlerts,
      };
    });

    return stats;
  }, [sensorHistory, alerts, panels, rtdbCurrent]);

  // ── Agréger les stats pour la sélection ────────────────────────────────────
  const aggregated = useMemo(() => {
    const sel = selectedPanels.length > 0 ? selectedPanels : panels.map((p) => p.id);
    const count = sel.length || 1;
    return sel.reduce(
      (acc, pid) => {
        const d = panelStats[pid] ?? { production: 0, revenue: 0, efficiency: 0, alerts: 0 };
        return {
          production: acc.production + d.production,
          revenue:    acc.revenue    + d.revenue,
          efficiency: acc.efficiency + d.efficiency / count,
          alerts:     acc.alerts     + d.alerts,
        };
      },
      { production: 0, revenue: 0, efficiency: 0, alerts: 0 }
    );
  }, [selectedPanels, panelStats, panels]);

  // ── Alertes actives réelles ─────────────────────────────────────────────────
  const activeAlerts = alerts.filter((a) => a.resolved !== true).length;

  const selectionLabel =
    selectedPanels.length === panels.length ? 'Tous les panneaux' :
    selectedPanels.length === 1 ? `Panneau ${selectedPanels[0]}` :
    `Panneaux ${selectedPanels.join(', ')}`;

  const dateStr = new Date().toISOString().slice(0, 10);

  // ── Colonnes et lignes communes ─────────────────────────────────────────────
  const colonnesStats = ['ID', 'Nom', 'Production (Wh)', 'Revenus (TND)', 'Efficacité (%)', 'Alertes'];

  const getLignes = (sel: string[]): (string | number)[][] =>
    sel.map((pid) => {
      const d = panelStats[pid] ?? { production: 0, revenue: 0, efficiency: 0, alerts: 0 };
      const p = panels.find((p) => p.id === pid);
      return [
        pid,
        p?.name ?? '',
        d.production.toFixed(2),
        d.revenue.toFixed(4),
        d.efficiency.toFixed(1),
        d.alerts,
      ];
    });

  // ── Générer un rapport PDF ──────────────────────────────────────────────────
  const handleGenerate = (reportId: string, reportName: string) => {
    const sel = selectedPanels.length > 0 ? selectedPanels : panels.map((p) => p.id);
    genererPDF(reportName, selectionLabel, colonnesStats, getLignes(sel), `rapport_${reportId}_${dateStr}`);
    toast.success(`Rapport "${reportName}" téléchargé !`);
  };

  // ── Export global CSV ───────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const sel = selectedPanels.length > 0 ? selectedPanels : panels.map((p) => p.id);
    genererCSV(colonnesStats, getLignes(sel), `export_panneaux_${dateStr}`);
    toast.success('Export CSV téléchargé !');
  };

  // ── Export global PDF ───────────────────────────────────────────────────────
  const handleExportPDF = () => {
    const sel = selectedPanels.length > 0 ? selectedPanels : panels.map((p) => p.id);
    genererPDF(
      'Export — ' + selectionLabel,
      `Production totale : ${aggregated.production.toFixed(2)} Wh`,
      colonnesStats,
      getLignes(sel),
      `export_${dateStr}`,
    );
    toast.success('Export PDF téléchargé !');
  };

  // ── Télécharger un rapport récent ───────────────────────────────────────────
  const handleDownloadRecent = (reportName: string, reportId: string, panelIds: string[]) => {
    const sel = panelIds.filter((pid) => panels.find((p) => p.id === pid));
    genererPDF(
      reportName,
      sel.map((pid) => panels.find((p) => p.id === pid)?.name ?? pid).join(', '),
      colonnesStats,
      getLignes(sel),
      `rapport_${reportId}_${dateStr}`,
    );
    toast.success('Téléchargement démarré !');
  };

  // Rapports récents
  const recentReports = useMemo(() => [
    { id: 'monthly', name: 'Rapport Mensuel — Mai 2026',       type: 'Mensuel',      panels: panels.map((p) => p.id),        size: '2.4 MB', format: 'PDF', date: new Date() },
    { id: 'weekly',  name: 'Rapport Hebdomadaire — Semaine 22', type: 'Hebdomadaire', panels: [panels[0]?.id].filter(Boolean), size: '856 KB', format: 'PDF', date: new Date() },
    { id: 'alerts',  name: "Rapport d'Alertes — Mai 2026",      type: 'Alertes',      panels: panels.map((p) => p.id),        size: '1.1 MB', format: 'PDF', date: new Date() },
  ], [panels]);

  const filteredReports = recentReports.filter((r) =>
    r.panels.some((pid) => selectedPanels.includes(pid))
  );

  if (loading) return <p className="text-center text-gray-500 py-8">Chargement des données Firebase...</p>;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapports & Statistiques</h1>
          <p className="text-sm text-gray-500 mt-1">
            Données réelles Firebase · {sensorHistory.length} entrées · Tarif {TARIF_TND_KWH} TND/kWh
          </p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600 text-white shrink-0" onClick={handleExportPDF}>
          <Download className="h-4 w-4 mr-2" /> Télécharger sélection
        </Button>
      </div>

      {/* Panel Filter */}
      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <BarChart3 className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filtrer par panneau :</span>
          </div>
          <PanelSelector panels={panels} selected={selectedPanels} onChange={setSelectedPanels} />
          <Badge variant="outline" className="ml-auto text-xs text-gray-500">{selectionLabel}</Badge>
        </div>
      </Card>

      {/* KPI Cards — données réelles Firebase */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Production Totale',
            value: `${aggregated.production.toFixed(2)} Wh`,
            sub:   `${(aggregated.production / 1000).toFixed(4)} kWh aujourd'hui`,
            icon: Zap, bg: 'bg-blue-50', color: 'text-blue-600',
          },
          {
            label: 'Revenus (TND)',
            value: `${aggregated.revenue.toFixed(4)} TND`,
            sub:   `Tarif STEG : ${TARIF_TND_KWH} TND/kWh`,
            icon: DollarSign, bg: 'bg-amber-50', color: 'text-amber-600',
          },
          {
            label: 'Alertes Totales',
            value: String(alerts.filter((a) => a.resolved !== true).length),
            sub:   `${activeAlerts} active${activeAlerts !== 1 ? 's' : ''}`,
            icon: AlertCircle, bg: 'bg-red-50', color: 'text-red-600',
          },
          {
            label: 'Efficacité Moy.',
            value: aggregated.efficiency > 0 ? `${aggregated.efficiency.toFixed(1)}%` : '—',
            sub:   aggregated.efficiency > 0 ? 'Basé sur 15W nominale' : 'En attente de données',
            icon: TrendingUp, bg: 'bg-purple-50', color: 'text-purple-600',
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
              </div>
              <div className={`p-3 ${kpi.bg} rounded-lg`}>
                <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Per-panel comparison */}
      {selectedPanels.length > 1 && (
        <Card className="p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Comparaison des panneaux</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="pb-3 font-medium text-gray-500">Panneau</th>
                  <th className="pb-3 font-medium text-gray-500">Production (Wh)</th>
                  <th className="pb-3 font-medium text-gray-500">Revenus (TND)</th>
                  <th className="pb-3 font-medium text-gray-500">Efficacité</th>
                  <th className="pb-3 font-medium text-gray-500">Alertes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {selectedPanels.map((pid) => {
                  const panel = panels.find((p) => p.id === pid);
                  const data  = panelStats[pid] ?? { production: 0, revenue: 0, efficiency: 0, alerts: 0 };
                  if (!panel) return null;
                  return (
                    <tr key={pid} className="hover:bg-gray-50">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-3 w-3 rounded-full ${colorDot[panel.color]}`} />
                          <span className="font-medium text-gray-900">{pid}</span>
                          <span className="text-gray-500">{panel.name}</span>
                        </div>
                      </td>
                      <td className="py-3 font-medium text-blue-600">{data.production.toFixed(2)} Wh</td>
                      <td className="py-3 text-amber-600">{data.revenue.toFixed(4)} TND</td>
                      <td className="py-3">
                        {data.efficiency > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${data.efficiency > 60 ? 'bg-green-500' : data.efficiency > 30 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(data.efficiency, 100)}%` }}
                              />
                            </div>
                            <span>{data.efficiency.toFixed(1)}%</span>
                          </div>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3 text-gray-600">{data.alerts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Report Types */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Types de Rapports</h2>
          <Badge variant="outline" className="text-xs text-gray-500">{selectionLabel}</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map((report) => {
            const Icon = report.icon;
            return (
              <div key={report.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 ${report.bgColor} rounded-lg shrink-0`}>
                    <Icon className={`h-5 w-5 ${report.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm">{report.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{report.description}</p>
                    <Button
                      size="sm" variant="outline" className="mt-2 text-xs h-7"
                      onClick={() => handleGenerate(report.id, report.name)}
                    >
                      <FileText className="h-3 w-3 mr-1" /> Générer
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent Reports */}
      <Card className="p-5">
        <h2 className="font-semibold text-gray-900 mb-4">
          Rapports Récents
          <span className="ml-2 text-sm font-normal text-gray-400">
            ({filteredReports.length} résultat{filteredReports.length !== 1 ? 's' : ''})
          </span>
        </h2>
        {filteredReports.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Aucun rapport pour la sélection actuelle</p>
        ) : (
          <div className="space-y-2">
            {filteredReports.map((report) => (
              <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-blue-50 rounded-lg shrink-0">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{report.name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">{report.type}</Badge>
                      {report.panels.map((pid) => {
                        const panel = panels.find((p) => p.id === pid);
                        return panel ? (
                          <span key={pid} className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${colorDot[panel.color]} text-white`}>
                            {pid}
                          </span>
                        ) : null;
                      })}
                      <span className="text-xs text-gray-400">{formatShortDate(report.date)}</span>
                      <Badge variant="outline" className="text-xs">{report.format}</Badge>
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 ml-2"
                  onClick={() => handleDownloadRecent(report.name, report.id, report.panels)}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Export */}
      <Card className="p-5 bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <Sun className="h-6 w-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Exporter les Données — {selectionLabel}</h3>
            <p className="text-sm text-gray-600 mt-1">
              {sensorHistory.length} entrées Firebase disponibles.
            </p>
            <div className="flex gap-3 mt-3 flex-wrap">
              <Button size="sm" variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                const sel = selectedPanels.length > 0 ? selectedPanels : panels.map((p) => p.id);
                const lignes = getLignes(sel);
                const csv = [colonnesStats.join('\t'), ...lignes.map(r => r.join('\t'))].join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `export_${dateStr}.xls`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success('Export Excel téléchargé !');
              }}>
                <Download className="h-4 w-4 mr-2" /> Excel
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportPDF}>
                <Download className="h-4 w-4 mr-2" /> PDF
              </Button>
            </div>
          </div>
        </div>
      </Card>

    </div>
  );
}
