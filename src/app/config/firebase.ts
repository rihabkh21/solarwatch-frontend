import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD5kDTdN3ZwiKV-lS3f6dHcJs-xOpD3nu8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "solarwatch-8c68a.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://solarwatch-8c68a-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "solarwatch-8c68a",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "solarwatch-8c68a.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "950107235339",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:950107235339:web:7d983db9c6c438bb91930e"
};

let app;
let auth;
let db;
let realtimeDb;

try {
  app = initializeApp(firebaseConfig);

  // Fix pour Capacitor — utilise indexedDB au lieu de localStorage
  if (Capacitor.isNativePlatform()) {
    auth = initializeAuth(app, {
      persistence: indexedDBLocalPersistence
    });
  } else {
    auth = getAuth(app);
  }

  db = getFirestore(app);
  realtimeDb = getDatabase(app);
} catch (error) {
  console.error('Firebase initialization error:', error);
  app = null;
  auth = null;
  db = null;
  realtimeDb = null;
}

const rtdb = realtimeDb;

export { auth, db, realtimeDb, rtdb };
export default app;