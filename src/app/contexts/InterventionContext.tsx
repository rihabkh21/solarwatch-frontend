import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, doc,
  arrayUnion, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Types exportés ────────────────────────────────────────────────────────────

export type InterventionStatus   = 'pending' | 'in_progress' | 'done';
export type InterventionPriority = 'critical' | 'warning' | 'info';

export interface InterventionMessage {
  id: string;
  from: string;
  fromName: string;
  fromRole: 'admin' | 'technicien';
  content: string;
  timestamp: string;
}

export interface Intervention {
  id: string;
  alertId?: string;
  title: string;
  description: string;
  priority: InterventionPriority;
  status: InterventionStatus;
  assignedTo: string;
  assignedToName: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  messages: InterventionMessage[];
}

// ─── Context ───────────────────────────────────────────────────────────────────

interface CreateInterventionPayload {
  title: string;
  description: string;
  priority: InterventionPriority;
  assignedTo: string;
  assignedToName: string;
  createdBy: string;
  createdByName: string;
  alertId?: string;
}

interface InterventionContextType {
  interventions: Intervention[];
  loading: boolean;
  createIntervention: (payload: CreateInterventionPayload) => Promise<Intervention>;
  updateStatus: (id: string, status: InterventionStatus, notes?: string) => Promise<void>;
  sendMessage: (id: string, from: string, fromName: string, fromRole: 'admin' | 'technicien', content: string) => Promise<void>;
  getMyInterventions: (email: string) => Intervention[];
  getInterventionById: (id: string) => Intervention | undefined;
  unreadCount: (email: string) => number;
}

const InterventionContext = createContext<InterventionContextType | undefined>(undefined);

export function InterventionProvider({ children }: { children: ReactNode }) {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Charger interventions depuis Firestore ──────────────────────────────────
  useEffect(() => {
    const q = query(collection(db, 'interventions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => {
        const item = d.data();
        return {
          id:             d.id,
          alertId:        item.alertId,
          title:          item.title,
          description:    item.description,
          priority:       item.priority,
          status:         item.status,
          assignedTo:     item.assignedTo,
          assignedToName: item.assignedToName,
          createdBy:      item.createdBy,
          createdByName:  item.createdByName,
          createdAt:      item.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt:      item.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          notes:          item.notes || '',
          messages:       item.messages || [],
        } as Intervention;
      });
      setInterventions(data);
      setLoading(false);
    }, (error) => {
      console.error('Erreur interventions:', error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Créer une intervention ──────────────────────────────────────────────────
  const createIntervention = async (payload: CreateInterventionPayload): Promise<Intervention> => {
    const now = new Date().toISOString();
    const firstMessage: InterventionMessage = {
      id:        `msg-${Date.now()}`,
      from:      payload.createdBy,
      fromName:  payload.createdByName,
      fromRole:  'admin',
      content:   `Nouvelle intervention créée : ${payload.description}`,
      timestamp: now,
    };

    const docData = {
      alertId:        payload.alertId || null,
      title:          payload.title,
      description:    payload.description,
      priority:       payload.priority,
      status:         'pending',
      assignedTo:     payload.assignedTo,
      assignedToName: payload.assignedToName,
      createdBy:      payload.createdBy,
      createdByName:  payload.createdByName,
      createdAt:      serverTimestamp(),
      updatedAt:      serverTimestamp(),
      notes:          '',
      messages:       [firstMessage],
    };

    const ref = await addDoc(collection(db, 'interventions'), docData);

    return {
      id:        ref.id,
      ...payload,
      status:    'pending',
      createdAt: now,
      updatedAt: now,
      notes:     '',
      messages:  [firstMessage],
    };
  };

  // ── Mettre à jour le statut ─────────────────────────────────────────────────
  const updateStatus = async (id: string, status: InterventionStatus, notes?: string) => {
    const updates: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
    if (notes !== undefined) updates.notes = notes;
    await updateDoc(doc(db, 'interventions', id), updates);
  };

  // ── Envoyer un message ──────────────────────────────────────────────────────
  const sendMessage = async (
    id: string,
    from: string,
    fromName: string,
    fromRole: 'admin' | 'technicien',
    content: string
  ) => {
    const newMsg: InterventionMessage = {
      id:        `msg-${Date.now()}`,
      from,
      fromName,
      fromRole,
      content,
      timestamp: new Date().toISOString(),
    };
    await updateDoc(doc(db, 'interventions', id), {
      messages:  arrayUnion(newMsg),
      updatedAt: serverTimestamp(),
    });
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getMyInterventions = (email: string): Intervention[] =>
    interventions.filter((i) => i.assignedTo === email || i.createdBy === email);

  const getInterventionById = (id: string): Intervention | undefined =>
    interventions.find((i) => i.id === id);

  const unreadCount = (email: string): number =>
    interventions.filter(
      (i) =>
        (i.assignedTo === email || i.createdBy === email) &&
        i.status !== 'done' &&
        i.messages.some((m) => m.from !== email)
    ).length;

  return (
    <InterventionContext.Provider
      value={{
        interventions,
        loading,
        createIntervention,
        updateStatus,
        sendMessage,
        getMyInterventions,
        getInterventionById,
        unreadCount,
      }}
    >
      {children}
    </InterventionContext.Provider>
  );
}

export function useInterventions() {
  const context = useContext(InterventionContext);
  if (context === undefined) {
    throw new Error('useInterventions must be used within an InterventionProvider');
  }
  return context;
}
