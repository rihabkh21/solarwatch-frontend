import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { Capacitor } from '@capacitor/core';

// Configuration Firebase : les valeurs sont lues depuis les variables d'environnement
// et tombent sur les valeurs du projet SolarWatch par defaut si absentes
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "AIzaSyD5kDTdN3ZwiKV-lS3f6dHcJs-xOpD3nu8",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "solarwatch-8c68a.firebaseapp.com",
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL       || "https://solarwatch-8c68a-default-rtdb.firebaseio.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "solarwatch-8c68a",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "solarwatch-8c68a.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "950107235339",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "1:950107235339:web:7d983db9c6c438bb91930e"
};

// Declaration des instances Firebase, initialisees dans le bloc try/catch
let app;
let auth;
let db;
let realtimeDb;

try {
  // Initialisation de l'application Firebase avec la configuration du projet
  app = initializeApp(firebaseConfig);

  // Fix pour Capacitor — utilise indexedDB au lieu de localStorage
  // Sur mobile (iOS/Android via Capacitor), localStorage n'est pas fiable pour la persistance
  // On utilise donc indexedDBLocalPersistence qui est supporte nativement sur les plateformes natives
  if (Capacitor.isNativePlatform()) {
    auth = initializeAuth(app, {
      persistence: indexedDBLocalPersistence
    });
  } else {
    // Sur le navigateur web, getAuth utilise la persistance par defaut (localStorage)
    auth = getAuth(app);
  }

  // Initialisation de Firestore (base de donnees principale : panneaux, interventions, utilisateurs)
  db = getFirestore(app);

  // Initialisation de Realtime Database (donnees capteurs temps reel de l'ESP32)
  realtimeDb = getDatabase(app);
} catch (error) {
  // En cas d'echec d'initialisation, toutes les instances sont nullifiees
  // pour eviter des erreurs en cascade dans le reste de l'application
  console.error('Firebase initialization error:', error);
  app = null;
  auth = null;
  db = null;
  realtimeDb = null;
}

// Alias de realtimeDb pour compatibilite avec les imports existants utilisant 'rtdb'
const rtdb = realtimeDb;

export { auth, db, realtimeDb, rtdb };
export default app;