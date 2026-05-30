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

export const loginWithEmail = async (email: string, password: string) => {
  if (!auth) throw new Error('Firebase Auth non initialisé');
  return await signInWithEmailAndPassword(auth, email, password);
};

export const logout = async () => {
  if (!auth) throw new Error('Firebase Auth non initialisé');
  return await signOut(auth);
};

export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

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

export const updateSensorData = async (data: SensorData) => {
  if (!realtimeDb) throw new Error('Firebase Realtime Database non initialisé');
  
  const sensorRef = ref(realtimeDb, 'sensors/current');
  await set(sensorRef, {
    ...data,
    updatedAt: Date.now()
  });
};

export const addSensorHistory = async (data: SensorData) => {
  if (!db) throw new Error('Firebase Firestore non initialisé');
  
  const historyRef = collection(db, 'sensorHistory');
  
  await addDoc(historyRef, {
    ...data,
    createdAt: serverTimestamp()
  });
};

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
        timestamp: docData.createdAt instanceof Timestamp 
          ? docData.createdAt.toDate().toISOString() 
          : docData.timestamp
      } as unknown as SensorData;
    });
    callback(data);
  });
};

export interface FirebaseAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  sensor: string;
  value?: number;
  threshold?: number;
  timestamp: string;
  resolved: boolean;
}

export const addAlert = async (alert: Omit<FirebaseAlert, 'id' | 'timestamp'>) => {
  if (!db) throw new Error('Firebase Firestore non initialisé');
  
  const alertsRef = collection(db, 'alerts');
  
  await addDoc(alertsRef, {
    ...alert,
    timestamp: serverTimestamp(),
    resolved: false
  });
};

export const listenToAlerts = (callback: (alerts: FirebaseAlert[]) => void) => {
  if (!db) {
    callback([]);
    return () => {};
  }
  
  const alertsRef = collection(db, 'alerts');
  const q = query(alertsRef, orderBy('timestamp', 'desc'), limit(50));
  
  return onSnapshot(q, (snapshot) => {
    const alerts = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        timestamp: data.timestamp instanceof Timestamp 
          ? data.timestamp.toDate().toISOString() 
          : new Date().toISOString()
      } as FirebaseAlert;
    });
    callback(alerts);
  });
};

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