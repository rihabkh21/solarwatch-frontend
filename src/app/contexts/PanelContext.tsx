import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SolarPanel } from '../data/mockData';
import type { UserRole } from './AuthContext';

// Broches ADC disponibles sur l'ESP32 pour les capteurs de tension et de courant
export const AVAILABLE_ADC_PINS = [32, 33, 34, 35, 36, 39];

// Adresses I2C supportees par le capteur BH1750 (direct ou via multiplexeur TCA9548A)
export const BH1750_ADDRESSES   = ['0x23', '0x5C', 'Mux TCA9548A'];

// Palette de couleurs tournante attribuee automatiquement a chaque nouveau panneau
const COLORS: SolarPanel['color'][] = ['amber', 'blue', 'green', 'purple', 'rose'];

// Assignations par defaut : chaque utilisateur voit uniquement ses panneaux attribues
const DEFAULT_ASSIGNMENTS: Record<string, string[]> = {
  'user@solarwatch.tn':  ['P1'],
  'leila@solarwatch.tn': ['P2'],
};

// Interface exposee par le contexte aux composants enfants
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
  // Assignations stockees en memoire (non persistees dans Firestore)
  const [userAssignments, setUserAssignments] = useState<Record<string, string[]>>(DEFAULT_ASSIGNMENTS);

  // ── Charger les panneaux depuis Firestore ─────────────────────────────────

  // Ecoute en temps reel la collection Firestore et met a jour la liste des panneaux
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'panels'), (snapshot) => {
      const data = snapshot.docs.map((d) => {
        const item = d.data() as any;
        // Fallback : compatibilité ancienne structure currentShunt → acs712
        // Assure la retrocompatibilite avec les documents Firestore crees avant la migration
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
    // Desinscription de l'ecouteur Firestore au demontage du composant
    return () => unsub();
  }, []);

  // ── Panel CRUD ────────────────────────────────────────────────────────────

  // Genere le prochain identifiant disponible en incrementant le numero max existant (ex: P3 -> P4)
  const nextId = (current: SolarPanel[]): string => {
    const nums = current.map((p) => parseInt(p.id.replace('P', ''), 10)).filter(Boolean);
    return `P${(Math.max(0, ...nums) + 1)}`;
  };

  // Attribue la premiere couleur de la palette non encore utilisee par un panneau existant
  const nextColor = (current: SolarPanel[]): SolarPanel['color'] => {
    const used = current.map((p) => p.color);
    return COLORS.find((c) => !used.includes(c)) ?? 'amber';
  };

  // Cree un nouveau panneau dans Firestore avec un ID et une couleur generes automatiquement
  const addPanel = async (panel: Omit<SolarPanel, 'id' | 'color'>) => {
    const id    = nextId(panels);
    const color = nextColor(panels);
    const newPanel: SolarPanel = { ...panel, id, color };
    await setDoc(doc(db, 'panels', id), newPanel);
  };

  // Met a jour les champs specifies d'un panneau existant dans Firestore
  const updatePanel = async (id: string, updates: Partial<SolarPanel>) => {
    await updateDoc(doc(db, 'panels', id), updates);
  };

  // Supprime un panneau de Firestore et retire son ID de toutes les assignations utilisateurs
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

  // Inverse l'etat actif/inactif d'un panneau dans Firestore
  const togglePanel = async (id: string) => {
    const panel = panels.find((p) => p.id === id);
    if (panel) await updateDoc(doc(db, 'panels', id), { active: !panel.active });
  };

  // ── Détection conflits GPIO ───────────────────────────────────────────────

  // Detecte les broches ADC partagees entre plusieurs panneaux, ce qui causerait des mesures incorrectes
  const getConflicts = (): { pin: number; panels: string[] }[] => {
    const pinMap: Record<number, string[]> = {};
    panels.forEach((p) => {
      const vPin = p.sensors?.voltageDivider?.adcPin;
      const cPin = p.sensors?.acs712?.adcPin;
      // Enregistre chaque panneau utilisant une broche donnee
      if (vPin !== undefined) pinMap[vPin] = [...(pinMap[vPin] ?? []), p.id];
      if (cPin !== undefined) pinMap[cPin] = [...(pinMap[cPin] ?? []), p.id];
    });
    // Retourne uniquement les broches utilisees par plus d'un panneau
    return Object.entries(pinMap)
      .filter(([, ids]) => ids.length > 1)
      .map(([pin, ids]) => ({ pin: Number(pin), panels: ids }));
  };

  // ── Assignation panneaux ──────────────────────────────────────────────────

  // Met a jour la liste des panneaux visibles pour un utilisateur donne
  const assignPanels = (email: string, panelIds: string[]) => {
    setUserAssignments((prev) => ({ ...prev, [email]: panelIds }));
  };

  // Retourne tous les panneaux pour admin/technicien, ou uniquement les panneaux assignes pour un user
  const getVisiblePanels = (email: string, role: UserRole): SolarPanel[] => {
    if (role === 'admin' || role === 'technicien') return panels;
    const assigned = userAssignments[email] ?? [];
    return panels.filter((p) => assigned.includes(p.id));
  };

  return (
    // Fournit toutes les fonctions de gestion des panneaux aux composants enfants
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

// Hook personnalise pour acceder au contexte des panneaux depuis n'importe quel composant
export function usePanels() {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error('usePanels must be used within PanelProvider');
  return ctx;
}
