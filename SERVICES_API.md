# 📡 API Services Firebase - Documentation Complète

## 🔐 AuthService

Service de gestion de l'authentification et des utilisateurs.

### Méthodes

#### `login(email: string, password: string)`
Connecte un utilisateur.

\`\`\`typescript
import { AuthService } from '../services/firebase';

const profile = await AuthService.login('admin@solarwatch.tn', 'password');
// Retourne: UserProfile { uid, email, displayName, role, createdAt, lastLogin }
\`\`\`

---

#### `register(email, password, displayName, role)`
Inscrit un nouvel utilisateur (Admin uniquement).

\`\`\`typescript
const profile = await AuthService.register(
  'tech@solarwatch.tn',
  'Password123!',
  'Mehdi Technicien',
  'technicien'
);
\`\`\`

---

#### `logout()`
Déconnecte l'utilisateur actuel.

\`\`\`typescript
await AuthService.logout();
\`\`\`

---

#### `getUserProfile(uid: string)`
Récupère le profil utilisateur depuis Firestore.

\`\`\`typescript
const profile = await AuthService.getUserProfile('user-uid-123');
\`\`\`

---

#### `onAuthStateChange(callback)`
Observe les changements d'état d'authentification.

\`\`\`typescript
const unsubscribe = AuthService.onAuthStateChange((user) => {
  if (user) {
    console.log('Utilisateur connecté:', user.email);
  } else {
    console.log('Utilisateur déconnecté');
  }
});

// Cleanup
return () => unsubscribe();
\`\`\`

---

#### `resetPassword(email: string)`
Envoie un email de réinitialisation de mot de passe.

\`\`\`typescript
await AuthService.resetPassword('user@example.com');
\`\`\`

---

#### `changePassword(newPassword: string)`
Change le mot de passe de l'utilisateur actuel.

\`\`\`typescript
await AuthService.changePassword('NewPassword123!');
\`\`\`

---

#### `hasPermission(userRole, requiredRole)`
Vérifie si un rôle a les permissions nécessaires.

\`\`\`typescript
const canAccess = AuthService.hasPermission('technicien', 'user'); // true
const cannotAccess = AuthService.hasPermission('user', 'admin'); // false
\`\`\`

**Hiérarchie:** admin (3) > technicien (2) > user (1)

---

## 📊 SensorService

Service de gestion des données capteurs ESP32.

### Méthodes

#### `saveSensorData(deviceId, sensorData)`
Enregistre les données capteur (utilisé par ESP32).

\`\`\`typescript
import { SensorService } from '../services/firebase';
import { generateRealtimeData } from '../data/mockData';

const data = generateRealtimeData();
await SensorService.saveSensorData('ESP32_001', data);
\`\`\`

---

#### `listenToSensorData(deviceId, callback)`
Écoute les données en temps réel.

\`\`\`typescript
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

#### `getCurrentSensorData(deviceId)`
Récupère les données actuelles (snapshot unique).

\`\`\`typescript
const data = await SensorService.getCurrentSensorData('ESP32_001');
if (data) {
  console.log('Température actuelle:', data.ds18b20.temperature);
}
\`\`\`

---

#### `getSensorHistory(deviceId, limitCount)`
Récupère l'historique des données.

\`\`\`typescript
const history = await SensorService.getSensorHistory('ESP32_001', 100);
history.forEach(entry => {
  console.log(`${entry.timestamp}: ${entry.calculated.power}W`);
});
\`\`\`

---

#### `createAlert(alert)`
Crée une nouvelle alerte.

\`\`\`typescript
const alertId = await SensorService.createAlert({
  type: 'warning',
  title: 'Température Élevée',
  message: 'Température panneau: 78°C',
  deviceId: 'ESP32_001',
  resolved: false,
  timestamp: Timestamp.now(),
});
\`\`\`

---

#### `getActiveAlerts(deviceId?)`
Récupère les alertes actives.

\`\`\`typescript
// Toutes les alertes actives
const allAlerts = await SensorService.getActiveAlerts();

// Alertes d'un appareil spécifique
const deviceAlerts = await SensorService.getActiveAlerts('ESP32_001');
\`\`\`

---

#### `resolveAlert(alertId)`
Marque une alerte comme résolue.

\`\`\`typescript
await SensorService.resolveAlert('alert-id-123');
\`\`\`

---

#### `saveESP32Config(config)`
Sauvegarde la configuration d'un ESP32.

\`\`\`typescript
await SensorService.saveESP32Config({
  deviceId: 'ESP32_001',
  name: 'Panneau Solaire Tunis',
  location: 'Tunis, Tunisie',
  solarPanelSpecs: {
    voltageRange: '6V-12V',
    maxPower: 10,
  },
  alertThresholds: {
    maxTemperature: 75,
    minVoltage: 5.0,
    minCurrent: 10,
  },
  active: true,
});
\`\`\`

---

#### `getESP32Config(deviceId)`
Récupère la configuration d'un ESP32.

\`\`\`typescript
const config = await SensorService.getESP32Config('ESP32_001');
if (config) {
  console.log('Nom:', config.name);
  console.log('Seuils:', config.alertThresholds);
}
\`\`\`

---

#### `getAllDevices()`
Récupère tous les appareils configurés.

\`\`\`typescript
const devices = await SensorService.getAllDevices();
devices.forEach(device => {
  console.log(`${device.deviceId}: ${device.name} (${device.location})`);
});
\`\`\`

---

#### `checkThresholdsAndAlert(deviceId, sensorData, config)`
Vérifie les seuils et crée des alertes automatiques.

\`\`\`typescript
const data = await SensorService.getCurrentSensorData('ESP32_001');
const config = await SensorService.getESP32Config('ESP32_001');

if (data && config) {
  await SensorService.checkThresholdsAndAlert('ESP32_001', data, config);
}
\`\`\`

---

#### `calculateStats(deviceId, hours)`
Calcule les statistiques sur une période.

\`\`\`typescript
const stats = await SensorService.calculateStats('ESP32_001', 24);

console.log('Puissance moyenne:', stats.avgPower, 'W');
console.log('Puissance max:', stats.maxPower, 'W');
console.log('Énergie totale:', stats.totalEnergy, 'Wh');
console.log('Température moyenne:', stats.avgTemperature, '°C');
console.log('Efficacité moyenne:', stats.avgEfficiency, '%');
\`\`\`

---

## 👥 UserService

Service de gestion des utilisateurs (Admin).

### Méthodes

#### `getAllUsers()`
Récupère tous les utilisateurs.

\`\`\`typescript
import { UserService } from '../services/firebase';

const users = await UserService.getAllUsers();
users.forEach(user => {
  console.log(`${user.displayName} (${user.role})`);
});
\`\`\`

---

#### `getUserById(uid)`
Récupère un utilisateur par son ID.

\`\`\`typescript
const user = await UserService.getUserById('user-uid-123');
\`\`\`

---

#### `updateUserProfile(uid, updates)`
Met à jour le profil d'un utilisateur.

\`\`\`typescript
await UserService.updateUserProfile('user-uid-123', {
  displayName: 'Nouveau Nom',
  phoneNumber: '+216 20 123 456',
  organization: 'STEG',
});
\`\`\`

---

#### `changeUserRole(uid, newRole)`
Change le rôle d'un utilisateur (Admin uniquement).

\`\`\`typescript
await UserService.changeUserRole('user-uid-123', 'technicien');
\`\`\`

---

#### `activateUser(uid)` / `deactivateUser(uid)`
Active ou désactive un utilisateur.

\`\`\`typescript
await UserService.deactivateUser('user-uid-123');
await UserService.activateUser('user-uid-123');
\`\`\`

---

#### `deleteUser(uid)`
Supprime un utilisateur (Admin uniquement).

\`\`\`typescript
await UserService.deleteUser('user-uid-123');
\`\`\`

---

#### `getUsersByRole(role)`
Récupère tous les utilisateurs d'un rôle spécifique.

\`\`\`typescript
const admins = await UserService.getUsersByRole('admin');
const techniciens = await UserService.getUsersByRole('technicien');
\`\`\`

---

#### `countUsersByRole()`
Compte les utilisateurs par rôle.

\`\`\`typescript
const counts = await UserService.countUsersByRole();
console.log('Admins:', counts.admin);
console.log('Techniciens:', counts.technicien);
console.log('Users:', counts.user);
\`\`\`

---

## 🪝 Hooks React

### `useFirebaseSensorData(deviceId)`

Hook pour écouter les données capteurs en temps réel.

\`\`\`typescript
import { useFirebaseSensorData } from '../hooks/useFirebaseSensorData';

function SensorMonitor() {
  const { sensorData, loading, error } = useFirebaseSensorData('ESP32_001');
  
  if (loading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error}</div>;
  
  return (
    <div>
      <p>Température: {sensorData?.ds18b20.temperature}°C</p>
      <p>Puissance: {sensorData?.calculated.power}W</p>
    </div>
  );
}
\`\`\`

---

### `useSensorHistory(deviceId, limitCount)`

Hook pour récupérer l'historique.

\`\`\`typescript
import { useSensorHistory } from '../hooks/useFirebaseSensorData';

function HistoryChart() {
  const { history, loading } = useSensorHistory('ESP32_001', 100);
  
  return (
    <div>
      {history.map((entry, i) => (
        <div key={i}>
          {new Date(entry.timestamp).toLocaleString()}: {entry.calculated.power}W
        </div>
      ))}
    </div>
  );
}
\`\`\`

---

### `useAuth()`

Hook pour accéder au contexte d'authentification.

\`\`\`typescript
import { useAuth } from '../contexts/AuthContext';

function UserProfile() {
  const { user, logout, hasRole, loading } = useAuth();
  
  if (loading) return <div>Chargement...</div>;
  
  return (
    <div>
      <p>Connecté en tant que: {user?.name}</p>
      <p>Rôle: {user?.role}</p>
      
      {hasRole('admin') && <AdminPanel />}
      
      <button onClick={logout}>Déconnexion</button>
    </div>
  );
}
\`\`\`

---

### `useCurrentTime(updateInterval?)`

Hook pour obtenir l'heure actuelle mise à jour automatiquement.

\`\`\`typescript
import { useCurrentTime } from '../hooks/useCurrentTime';

function Clock() {
  const currentTime = useCurrentTime(1000); // Update every second
  
  return (
    <div>
      {currentTime.toLocaleTimeString('fr-TN')}
    </div>
  );
}
\`\`\`

---

## 📋 Types TypeScript

### `UserProfile`

\`\`\`typescript
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'technicien' | 'user';
  createdAt: any;
  lastLogin: any;
  photoURL?: string;
  phoneNumber?: string;
  organization?: string;
}
\`\`\`

---

### `ESP32SensorData`

\`\`\`typescript
interface ESP32SensorData {
  timestamp: number;
  ds18b20: {
    temperature: number;
    address: string;
  };
  bh1750: {
    lux: number;
    lightLevel: 'dark' | 'dim' | 'normal' | 'bright';
    mode: string;
  };
  voltageDivider: {
    voltage: number;
    voltageRaw: number;
    r1: string;
    r2: string;
  };
  currentShunt: {
    current: number;
    voltageDropMv: number;
    shuntResistance: number;
  };
  esp32: {
    model: string;
    wifiSignal: number;
    uptime: number;
    freeHeap: number;
    voltage: number;
  };
  calculated: {
    power: number;
    energy24h: number;
    efficiency: number;
    revenue24h: number;
  };
}
\`\`\`

---

### `SystemAlert`

\`\`\`typescript
interface SystemAlert {
  id?: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: any;
  resolved: boolean;
  deviceId: string;
}
\`\`\`

---

### `ESP32Config`

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
    maxTemperature: number;
    minVoltage: number;
    minCurrent: number;
  };
  active: boolean;
}
\`\`\`

---

## 🔥 Utilitaires Firebase (Dev)

Disponibles dans la console navigateur via `window.firebaseUtils` :

### `initializeFirebaseDemo()`
Initialise Firebase avec toutes les données de test.

### `createDemoESP32Config()`
Crée une configuration ESP32 de démonstration.

### `sendMockSensorData(deviceId?)`
Envoie des données simulées une fois.

### `startDataSimulator(deviceId?)`
Démarre un simulateur qui envoie des données toutes les 3s.

### `stopDataSimulator()`
Arrête le simulateur de données.

### `createDemoAlerts(deviceId?)`
Crée des alertes de démonstration.

---

## 📞 Support

Pour plus d'informations, consultez :
- [README_FIREBASE.md](/README_FIREBASE.md)
- [FIREBASE_SETUP.md](/FIREBASE_SETUP.md)
- [BACKEND_ARCHITECTURE.md](/BACKEND_ARCHITECTURE.md)
