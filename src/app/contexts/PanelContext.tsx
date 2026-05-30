import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SolarPanel } from '../data/mockData';
import type { UserRole } from './AuthContext';

export const AVAILABLE_ADC_PINS = [32, 33, 34, 35, 36, 39];
export const BH1750_ADDRESSES   = ['0x23', '0x5C', 'Mux TCA9548A'];

const COLORS: SolarPanel['color'][] = ['amber', 'blue', 'green', 'purple', 'rose'];

const DEFAULT_ASSIGNMENTS: Record<string, string[]> = {
  'user@solarwatch.tn':  ['P1'],
  'leila@solarwatch.tn': ['P2'],
};

interface PanelContextType {
  panels: SolarPanel[];
  loading: boolean;
  addPanel:     (panel: Omit<SolarPanel, 'id' | 'color'>) => Promise<void>;
  updatePanel:  (id: string, updates: Partial<SolarPanel>) => Promise<void>;
  deletePanel:  (id: string) => Promise<void>;
  togglePanel:  (id: string) => Promise<void>;
  getConflicts: () => { pin: number; panels: string[] }[];
  userAssignments:  Record<string, string[]>;
  assignPanels:     (email: string, panelIds: string[]) => void;
  getVisiblePanels: (email: string, role: UserRole) => SolarPanel[];
}

const PanelContext = createContext<PanelContextType | undefined>(undefined);

export function PanelProvider({ children }: { children: ReactNode }) {
  const [panels, setPanels]                   = useState<SolarPanel[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [userAssignments, setUserAssignments] = useState<Record<string, string[]>>(DEFAULT_ASSIGNMENTS);

  // ── Charger les panneaux depuis Firestore ─────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'panels'), (snapshot) => {
      const data = snapshot.docs.map((d) => {
        const item = d.data() as any;
        // Fallback : compatibilité ancienne structure currentShunt → acs712
        const acs712 = item.sensors?.acs712 ?? {
          adcPin:      item.sensors?.currentShunt?.adcPin ?? 35,
          sensitivity: 185,
          model:       'ACS712-05B',
        };
        return {
          ...item,
          sensors: {
            ...item.sensors,
            acs712,
          },
        } as SolarPanel;
      });
      setPanels(data);
      setLoading(false);
    }, (error) => {
      console.error('Erreur Firestore panels:', error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Panel CRUD ────────────────────────────────────────────────────────────

  const nextId = (current: SolarPanel[]): string => {
    const nums = current.map((p) => parseInt(p.id.replace('P', ''), 10)).filter(Boolean);
    return `P${(Math.max(0, ...nums) + 1)}`;
  };

  const nextColor = (current: SolarPanel[]): SolarPanel['color'] => {
    const used = current.map((p) => p.color);
    return COLORS.find((c) => !used.includes(c)) ?? 'amber';
  };

  const addPanel = async (panel: Omit<SolarPanel, 'id' | 'color'>) => {
    const id    = nextId(panels);
    const color = nextColor(panels);
    const newPanel: SolarPanel = { ...panel, id, color };
    await setDoc(doc(db, 'panels', id), newPanel);
  };

  const updatePanel = async (id: string, updates: Partial<SolarPanel>) => {
    await updateDoc(doc(db, 'panels', id), updates);
  };

  const deletePanel = async (id: string) => {
    await deleteDoc(doc(db, 'panels', id));
    setUserAssignments((prev) => {
      const next: Record<string, string[]> = {};
      Object.entries(prev).forEach(([email, ids]) => {
        next[email] = ids.filter((pid) => pid !== id);
      });
      return next;
    });
  };

  const togglePanel = async (id: string) => {
    const panel = panels.find((p) => p.id === id);
    if (panel) await updateDoc(doc(db, 'panels', id), { active: !panel.active });
  };

  // ── Détection conflits GPIO ───────────────────────────────────────────────

  const getConflicts = (): { pin: number; panels: string[] }[] => {
    const pinMap: Record<number, string[]> = {};
    panels.forEach((p) => {
      const vPin = p.sensors?.voltageDivider?.adcPin;
      const cPin = p.sensors?.acs712?.adcPin;
      if (vPin !== undefined) pinMap[vPin] = [...(pinMap[vPin] ?? []), p.id];
      if (cPin !== undefined) pinMap[cPin] = [...(pinMap[cPin] ?? []), p.id];
    });
    return Object.entries(pinMap)
      .filter(([, ids]) => ids.length > 1)
      .map(([pin, ids]) => ({ pin: Number(pin), panels: ids }));
  };

  // ── Assignation panneaux ──────────────────────────────────────────────────

  const assignPanels = (email: string, panelIds: string[]) => {
    setUserAssignments((prev) => ({ ...prev, [email]: panelIds }));
  };

  const getVisiblePanels = (email: string, role: UserRole): SolarPanel[] => {
    if (role === 'admin' || role === 'technicien') return panels;
    const assigned = userAssignments[email] ?? [];
    return panels.filter((p) => assigned.includes(p.id));
  };

  return (
    <PanelContext.Provider
      value={{
        panels,
        loading,
        addPanel,
        updatePanel,
        deletePanel,
        togglePanel,
        getConflicts,
        userAssignments,
        assignPanels,
        getVisiblePanels,
      }}
    >
      {children}
    </PanelContext.Provider>
  );
}

export function usePanels() {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error('usePanels must be used within PanelProvider');
  return ctx;
}
