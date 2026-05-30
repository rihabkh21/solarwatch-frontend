# 🏗️ Architecture Backend Firebase - SolarWatch IoT Platform

## 📁 Structure des Fichiers Backend

\`\`\`
/src/app/
├── config/
│   └── firebase.ts                    # Configuration Firebase (API keys)
│
├── services/
│   └── firebase/
│       ├── auth.service.ts           # Service d'authentification
│       ├── sensor.service.ts         # Service de gestion des données capteurs
│       ├── user.service.ts           # Service de gestion des utilisateurs
│       └── index.ts                  # Export centralisé
│
├── hooks/
│   ├── useFirebaseSensorData.ts      # Hook pour données temps réel
│   ├── useSensorData.ts              # Hook avec données mock (fallback)
│   └── useCurrentTime.ts             # Hook pour l'horloge
│
├── contexts/
│   └── AuthContext.tsx               # Context React + Firebase Auth
│
└── pages/
    └── FirebaseExample.tsx           # Exemple d'utilisation complet
\`\`\`

---

## 🔥 Services Firebase Implémentés

### 1. AuthService (`auth.service.ts`)

**Responsabilités :**
- Authentification des utilisateurs
- Gestion des profils utilisateurs
- Contrôle d'accès basé sur les rôles (RBAC)
- Réinitialisation de mot de passe

**Méthodes principales :**

\`\`\`typescript
// Connexion
AuthService.login(email, password)

// Inscription (Admin uniquement)
AuthService.register(email, password, displayName, role)

// Déconnexion
AuthService.logout()

// Récupérer profil
AuthService.getUserProfile(uid)

// Observer changements
AuthService.onAuthStateChange(callback)

// Vérifier permissions
AuthService.hasPermission(userRole, requiredRole)
\`\`\`

**Exemple d'utilisation :**

\`\`\`typescript
import { AuthService } from '../services/firebase';

const handleLogin = async () => {
  try {
    const profile = await AuthService.login('admin@solarwatch.tn', 'password');
    console.log('Connecté:', profile);
  } catch (error) {
    console.error('Erreur:', error);
  }
};
\`\`\`

---

### 2. SensorService (`sensor.service.ts`)

**Responsabilités :**
- Enregistrer les données capteurs en temps réel
- Écouter les mises à jour live
- Archiver l'historique
- Gérer les alertes système
- Configuration des appareils ESP32

**Méthodes principales :**

\`\`\`typescript
// Sauvegarder données (ESP32 → Firebase)
SensorService.saveSensorData(deviceId, sensorData)

// Écouter en temps réel
SensorService.listenToSensorData(deviceId, callback)

// Récupérer données actuelles
SensorService.getCurrentSensorData(deviceId)

// Récupérer historique
SensorService.getSensorHistory(deviceId, limit)

// Créer une alerte
SensorService.createAlert(alert)

// Récupérer alertes actives
SensorService.getActiveAlerts(deviceId?)

// Résoudre une alerte
SensorService.resolveAlert(alertId)

// Configuration ESP32
SensorService.saveESP32Config(config)
SensorService.getESP32Config(deviceId)
SensorService.getAllDevices()

// Vérifier seuils
SensorService.checkThresholdsAndAlert(deviceId, sensorData, config)

// Statistiques
SensorService.calculateStats(deviceId, hours)
\`\`\`

**Exemple d'utilisation :**

\`\`\`typescript
import { SensorService } from '../services/firebase';

// Écouter les données en temps réel
const unsubscribe = SensorService.listenToSensorData('ESP32_001', (data) => {
  if (data) {
    console.log('Température:', data.ds18b20.temperature);
    console.log('Puissance:', data.calculated.power);
  }
});

// Cleanup
return () => unsubscribe();
\`\`\`

---

### 3. UserService (`user.service.ts`)

**Responsabilités :**
- Gestion des utilisateurs (Admin)
- Modification des rôles
- Activation/Désactivation
- Statistiques utilisateurs

**Méthodes principales :**

\`\`\`typescript
// Récupérer tous les utilisateurs
UserService.getAllUsers()

// Récupérer par ID
UserService.getUserById(uid)

// Mettre à jour profil
UserService.updateUserProfile(uid, updates)

// Changer rôle
UserService.changeUserRole(uid, newRole)

// Activer/Désactiver
UserService.activateUser(uid)
UserService.deactivateUser(uid)

// Supprimer
UserService.deleteUser(uid)

// Récupérer par rôle
UserService.getUsersByRole(role)

// Compter par rôle
UserService.countUsersByRole()
\`\`\`

---

## 🪝 Hooks React Personnalisés

### useFirebaseSensorData

Hook pour écouter les données capteurs en temps réel :

\`\`\`typescript
import { useFirebaseSensorData } from '../hooks/useFirebaseSensorData';

function MyComponent() {
  const { sensorData, loading, error } = useFirebaseSensorData('ESP32_001');
  
  if (loading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error}</div>;
  
  return (
    <div>
      Température: {sensorData?.ds18b20.temperature}°C
    </div>
  );
}
\`\`\`

### useSensorHistory

Hook pour récupérer l'historique :

\`\`\`typescript
import { useSensorHistory } from '../hooks/useFirebaseSensorData';

function HistoryComponent() {
  const { history, loading } = useSensorHistory('ESP32_001', 100);
  
  return (
    <div>
      {history.map((entry, i) => (
        <div key={i}>
          {entry.ds18b20.temperature}°C à {new Date(entry.timestamp).toLocaleString()}
        </div>
      ))}
    </div>
  );
}
\`\`\`

---

## 🔐 Système RBAC (Role-Based Access Control)

### Hiérarchie des Rôles

\`\`\`
admin       (niveau 3) - Accès total
    ↓
technicien  (niveau 2) - Dashboard + Surveillance + Alertes
    ↓
user        (niveau 1) - Dashboard uniquement
\`\`\`

### Permissions par Rôle

| Fonctionnalité | Admin | Technicien | User |
|----------------|-------|------------|------|
| Dashboard | ✅ | ✅ | ✅ |
| Surveillance Temps Réel | ✅ | ✅ | ❌ |
| Historique | ✅ | ✅ | ❌ |
| Alertes (lecture) | ✅ | ✅ | ❌ |
| Alertes (résolution) | ✅ | ✅ | ❌ |
| Paramètres Système | ✅ | ❌ | ❌ |
| Gestion Utilisateurs | ✅ | ❌ | ❌ |
| Configuration ESP32 | ✅ | ❌ | ❌ |

### Utilisation dans les Composants

\`\`\`typescript
import { useAuth } from '../contexts/AuthContext';

function AdminPanel() {
  const { hasRole } = useAuth();
  
  if (!hasRole('admin')) {
    return <div>Accès refusé</div>;
  }
  
  return <div>Panel Admin</div>;
}
\`\`\`

---

## 📊 Structure des Données

### SensorData (Realtime Database)

\`\`\`typescript
interface ESP32SensorData {
  timestamp: number;
  ds18b20: {
    temperature: number;        // °C
    address: string;           // Adresse 1-Wire
  };
  bh1750: {
    lux: number;              // Luminosité en lux
    lightLevel: 'dark' | 'dim' | 'normal' | 'bright';
    mode: string;
  };
  voltageDivider: {
    voltage: number;          // Tension calculée (V)
    voltageRaw: number;       // Valeur ADC brute
    r1: string;               // "30kΩ"
    r2: string;               // "10kΩ"
  };
  currentShunt: {
    current: number;          // Courant en mA
    voltageDropMv: number;    // Chute de tension en mV
    shuntResistance: number;  // 0.1Ω
  };
  esp32: {
    model: string;            // "ESP32-WROOM-32U"
    wifiSignal: number;       // dBm
    uptime: number;           // secondes
    freeHeap: number;         // bytes
    voltage: number;          // Alimentation USB
  };
  calculated: {
    power: number;            // Watts
    energy24h: number;        // Wh sur 24h
    efficiency: number;       // %
    revenue24h: number;       // TND
  };
}
\`\`\`

### SystemAlert (Firestore)

\`\`\`typescript
interface SystemAlert {
  id?: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: Timestamp;
  resolved: boolean;
  deviceId: string;
}
\`\`\`

### ESP32Config (Firestore)

\`\`\`typescript
interface ESP32Config {
  deviceId: string;
  name: string;
  location: string;
  solarPanelSpecs: {
    voltageRange: string;
    maxPower: number;
  };
  alertThresholds: {
    maxTemperature: number;   // °C
    minVoltage: number;       // V
    minCurrent: number;       // mA
  };
  active: boolean;
}
\`\`\`

---

## 🔄 Flux de Données

### ESP32 → Firebase

\`\`\`
ESP32 lit les capteurs
    ↓
Calcule les valeurs
    ↓
Crée JSON
    ↓
HTTP PUT vers Realtime Database
    ↓
Firebase déclenche onValue listeners
    ↓
React reçoit les nouvelles données
    ↓
UI se met à jour automatiquement
\`\`\`

### Archivage Automatique

\`\`\`
Données arrivent dans Realtime DB
    ↓
SensorService.saveSensorData()
    ↓
Archivage dans Firestore (sensorHistory)
    ↓
Vérification des seuils
    ↓
Création alertes si nécessaire
\`\`\`

---

## 🛡️ Sécurité

### Firebase Security Rules (Firestore)

\`\`\`javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    
    function isAdmin() {
      return request.auth != null && getUserRole() == 'admin';
    }
    
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if isAdmin() || request.auth.uid == userId;
    }
    
    match /sensorHistory/{docId} {
      allow read: if request.auth != null;
      allow create: if true; // ESP32 peut écrire
      allow update, delete: if isAdmin();
    }
  }
}
\`\`\`

### Firebase Security Rules (Realtime Database)

\`\`\`json
{
  "rules": {
    "sensors": {
      "$deviceId": {
        "current": {
          ".read": true,
          ".write": true
        }
      }
    }
  }
}
\`\`\`

---

## 📈 Performances

### Optimisations Implémentées

1. **Realtime Database** pour les données live (faible latence)
2. **Firestore** pour l'historique (requêtes complexes)
3. **React Hooks** avec cleanup automatique
4. **Listeners** avec unsubscribe pour éviter les fuites mémoire
5. **Pagination** de l'historique (limit queries)

### Coûts Firebase (Gratuit jusqu'à) :

- **Realtime Database** : 1 GB stockage, 10 GB/mois download
- **Firestore** : 1 GB stockage, 50K lectures/jour, 20K écritures/jour
- **Authentication** : Illimité

---

## 🧪 Tests

### Tester avec des Données Mock

Avant de connecter l'ESP32, testez avec des données simulées :

\`\`\`typescript
import { SensorService } from '../services/firebase';
import { generateRealtimeData } from '../data/mockData';

// Simuler l'envoi ESP32
const sendMockData = async () => {
  const mockData = generateRealtimeData();
  await SensorService.saveSensorData('ESP32_TEST', mockData);
};

// Envoyer toutes les 3 secondes
setInterval(sendMockData, 3000);
\`\`\`

---

## 🚀 Déploiement

### Variables d'Environnement

Pour la production, utilisez des variables d'environnement :

\`\`\`.env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_DATABASE_URL=your_database_url
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
\`\`\`

Puis dans `firebase.ts` :

\`\`\`typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // ...
};
\`\`\`

---

## 📞 Support Technique

- 📧 Email : support@solarwatch.tn
- 📖 Documentation Firebase : https://firebase.google.com/docs
- 🐛 Issues GitHub : [votre repo]

---

## ✅ Checklist de Configuration

- [ ] Créer projet Firebase
- [ ] Activer Authentication (Email/Password)
- [ ] Créer Firestore Database
- [ ] Créer Realtime Database
- [ ] Configurer Security Rules
- [ ] Copier les clés dans `/src/app/config/firebase.ts`
- [ ] Créer premier utilisateur Admin
- [ ] Tester connexion
- [ ] Configurer ESP32
- [ ] Vérifier réception données
- [ ] Tester alertes

---

**🎉 Votre backend Firebase est maintenant opérationnel !**
