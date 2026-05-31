import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { ref, onValue, set } from 'firebase/database';
import { auth, db, realtimeDb } from '../config/firebase';
import type { SensorData } from '../data/mockData';

// Connecte un utilisateur avec email et mot de passe via Firebase Authentication
export const loginWithEmail = async (email: string, password: string) => {
  if (!auth) throw new Error('Firebase Auth non initialisé');
  return await signInWithEmailAndPassword(auth, email, password);
};

// Deconnecte l'utilisateur actuellement connecte
export const logout = async () => {
  if (!auth) throw new Error('Firebase Auth non initialisé');
  return await signOut(auth);
};

// Abonne un callback aux changements d'etat de connexion Firebase
// Retourne une fonction vide si Firebase Auth n'est pas initialise
export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

// Ecoute en temps reel le noeud 'sensors/current' dans Realtime Database
// et appelle le callback a chaque nouvelle mesure recue
export const listenToSensorData = (callback: (data: SensorData) => void) => {
  if (!realtimeDb) {
    return () => {};
  }
  
  const sensorRef = ref(realtimeDb, 'sensors/current');
  
  return onValue(sensorRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    }
  });
};

// Ecrase les donnees courantes du capteur dans Realtime Database
// avec horodatage local en millisecondes
export const updateSensorData = async (data: SensorData) => {
  if (!realtimeDb) throw new Error('Firebase Realtime Database non initialisé');
  
  const sensorRef = ref(realtimeDb, 'sensors/current');
  await set(sensorRef, {
    ...data,
    updatedAt: Date.now()
  });
};

// Ajoute une entree dans la collection Firestore 'sensorHistory'
// avec horodatage serveur pour conserver l'historique des mesures
export const addSensorHistory = async (data: SensorData) => {
  if (!db) throw new Error('Firebase Firestore non initialisé');
  
  const historyRef = collection(db, 'sensorHistory');
  
  await addDoc(historyRef, {
    ...data,
    createdAt: serverTimestamp()
  });
};

// Ecoute en temps reel les N dernieres entrees de l'historique capteurs,
// triees par date decroissante, et convertit les Timestamps Firestore en ISO string
export const listenToRecentHistory = (
  limitCount: number,
  callback: (data: SensorData[]) => void
) => {
  if (!db) {
    callback([]);
    return () => {};
  }
  
  const historyRef = collection(db, 'sensorHistory');
  const q = query(historyRef, orderBy('createdAt', 'desc'), limit(limitCount));
  
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => {
      const docData = doc.data();
      return {
        ...docData,
        id: doc.id,
        // Conversion du Timestamp Firestore en chaine ISO, ou conservation du timestamp existant
        timestamp: docData.createdAt instanceof Timestamp 
          ? docData.createdAt.toDate().toISOString() 
          : docData.timestamp
      } as unknown as SensorData;
    });
    callback(data);
  });
};

// Structure d'une alerte stockee dans Firestore
export interface FirebaseAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  sensor: string;
  value?: number;       // Valeur mesuree ayant declenche l'alerte
  threshold?: number;   // Seuil qui a ete depasse
  timestamp: string;
  resolved: boolean;
}

// Cree une nouvelle alerte dans Firestore avec horodatage serveur
// et statut 'resolved: false' par defaut
export const addAlert = async (alert: Omit<FirebaseAlert, 'id' | 'timestamp'>) => {
  if (!db) throw new Error('Firebase Firestore non initialisé');
  
  const alertsRef = collection(db, 'alerts');
  
  await addDoc(alertsRef, {
    ...alert,
    timestamp: serverTimestamp(),
    resolved: false
  });
};

// Ecoute en temps reel les 50 dernieres alertes triees par date decroissante
// et convertit les Timestamps Firestore en chaines ISO lisibles
export const listenToAlerts = (callback: (alerts: FirebaseAlert[]) => void) => {
  if (!db) {
    callback([]);
    return () => {};
  }
  
  const alertsRef = collection(db, 'alerts');
  // Limite a 50 alertes pour eviter de charger un historique trop volumineux
  const q = query(alertsRef, orderBy('timestamp', 'desc'), limit(50));
  
  return onSnapshot(q, (snapshot) => {
    const alerts = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        // Fallback sur l'heure actuelle si le Timestamp Firestore est absent
        timestamp: data.timestamp instanceof Timestamp 
          ? data.timestamp.toDate().toISOString() 
          : new Date().toISOString()
      } as FirebaseAlert;
    });
    callback(alerts);
  });
};

// Enregistre les statistiques journalieres (energie, rendement, revenu) dans Firestore
// pour constituer un historique de performance du systeme solaire
export const saveStats = async (stats: {
  totalEnergy24h: number;
  efficiency: number;
  revenue: string;
  date: string;
}) => {
  if (!db) throw new Error('Firebase Firestore non initialisé');
  
  const statsRef = collection(db, 'dailyStats');
  
  await addDoc(statsRef, {
    ...stats,
    createdAt: serverTimestamp()
  });
};