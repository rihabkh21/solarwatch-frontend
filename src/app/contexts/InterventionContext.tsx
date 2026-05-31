import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, doc,
  arrayUnion, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ─── Types exportés ────────────────────────────────────────────────────────────

// Statuts possibles d'une intervention : en attente, en cours ou terminee
export type InterventionStatus   = 'pending' | 'in_progress' | 'done';

// Niveaux de priorite d'une intervention, alignes sur les types d'alertes capteurs
export type InterventionPriority = 'critical' | 'warning' | 'info';

// Structure d'un message echange entre admin et technicien dans une intervention
export interface InterventionMessage {
  id: string;
  from: string;
  fromName: string;
  fromRole: 'admin' | 'technicien';
  content: string;
  timestamp: string;
}

// Structure complete d'une intervention de maintenance
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

// Donnees necessaires pour creer une nouvelle intervention
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

// Interface exposee par le contexte aux composants enfants
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

  // Ecoute en temps reel la collection Firestore et met a jour l'etat local a chaque changement
  useEffect(() => {
    // Requete triee par date de creation decroissante (plus recentes en premier)
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
          // Conversion du Timestamp Firestore en chaine ISO pour uniformite
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
    // Desinscription de l'ecouteur Firestore au demontage du composant
    return () => unsub();
  }, []);

  // ── Créer une intervention ──────────────────────────────────────────────────

  // Cree une intervention dans Firestore avec un premier message automatique de l'admin
  const createIntervention = async (payload: CreateInterventionPayload): Promise<Intervention> => {
    const now = new Date().toISOString();
    // Message initial genere automatiquement pour tracer la creation de l'intervention
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
      status:         'pending',         // Toute nouvelle intervention commence en attente
      assignedTo:     payload.assignedTo,
      assignedToName: payload.assignedToName,
      createdBy:      payload.createdBy,
      createdByName:  payload.createdByName,
      createdAt:      serverTimestamp(), // Horodatage serveur Firestore pour eviter les decalages horaires
      updatedAt:      serverTimestamp(),
      notes:          '',
      messages:       [firstMessage],
    };

    const ref = await addDoc(collection(db, 'interventions'), docData);

    // Retourne l'objet local immediatement sans attendre la mise a jour Firestore
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

  // Met a jour le statut d'une intervention et, si fourni, les notes associees
  const updateStatus = async (id: string, status: InterventionStatus, notes?: string) => {
    const updates: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
    if (notes !== undefined) updates.notes = notes;
    await updateDoc(doc(db, 'interventions', id), updates);
  };

  // ── Envoyer un message ──────────────────────────────────────────────────────

  // Ajoute un message dans le fil de discussion d'une intervention via arrayUnion Firestore
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
    // arrayUnion ajoute le message sans ecraser les messages existants
    await updateDoc(doc(db, 'interventions', id), {
      messages:  arrayUnion(newMsg),
      updatedAt: serverTimestamp(),
    });
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  // Retourne les interventions ou l'utilisateur est implique (assignataire ou createur)
  const getMyInterventions = (email: string): Intervention[] =>
    interventions.filter((i) => i.assignedTo === email || i.createdBy === email);

  // Recherche une intervention par son identifiant unique
  const getInterventionById = (id: string): Intervention | undefined =>
    interventions.find((i) => i.id === id);

  // Compte les interventions non terminees avec des messages d'autres utilisateurs (badge de notification)
  const unreadCount = (email: string): number =>
    interventions.filter(
      (i) =>
        (i.assignedTo === email || i.createdBy === email) &&
        i.status !== 'done' &&
        i.messages.some((m) => m.from !== email)
    ).length;

  return (
    // Fournit toutes les fonctions et donnees d'intervention aux composants enfants
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

// Hook personnalise pour acceder au contexte d'intervention depuis n'importe quel composant
export function useInterventions() {
  const context = useContext(InterventionContext);
  if (context === undefined) {
    throw new Error('useInterventions must be used within an InterventionProvider');
  }
  return context;
}
