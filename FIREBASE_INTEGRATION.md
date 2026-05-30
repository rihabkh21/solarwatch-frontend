# 🔥 Intégration Firebase - SolarWatch

## ✅ Ce qui a été ajouté

### 📦 **Services Firebase**

#### 1. **Configuration** (`/src/app/config/firebase.ts`)
```typescript
- Firebase App initialisé
- Firebase Auth
- Firestore Database
- Realtime Database
```

#### 2. **Services** (`/src/app/services/firebaseService.ts`)
```typescript
✅ Authentication (Email/Password)
✅ Données capteurs (Realtime Database)
✅ Historique (Firestore)
✅ Alertes (Firestore)
✅ Statistiques (Firestore)
```

#### 3. **Hooks** (`/src/app/hooks/useFirebaseSensorData.ts`)
```typescript
✅ Hook personnalisé pour Firebase
✅ Fallback sur mock data
✅ Temps réel avec listeners
```

#### 4. **Context** (`/src/app/contexts/AuthContext.tsx`)
```typescript
✅ Auth Firebase + Auth locale
✅ Toggle entre les deux modes
✅ Persistance localStorage
```

---

## 🎯 **Nouvelle Page Settings**

### **Route** : `/settings`
### **Accessible** : Tous les utilisateurs (Admin, Technicien, User)

**Fonctionnalités** :
- ✅ Toggle Firebase ON/OFF
- ✅ Voir le statut du backend
- ✅ Guide de configuration
- ✅ Documentation intégrée

---

## 🔧 **Comment Configurer Firebase**

### **Étape 1 : Créer un Projet Firebase**

1. Allez sur [console.firebase.google.com](https://console.firebase.google.com)
2. Cliquez sur **"Ajouter un projet"**
3. Nommez-le : `solarwatch-tunisia`
4. Activez Google Analytics (optionnel)

### **Étape 2 : Activer les Services**

#### **Authentication** :
1. Dans la console Firebase : `Authentication` → `Get Started`
2. Activez `Email/Password`
3. Créez 3 utilisateurs de test :
   ```
   admin@solarwatch.tn (password: admin123)
   tech@solarwatch.tn (password: tech123)
   user@solarwatch.tn (password: user123)
   ```

#### **Firestore Database** :
1. `Firestore Database` → `Créer une base de données`
2. Mode : **Test** (pour développement)
3. Région : **europe-west1** (proche Tunisie)

#### **Realtime Database** :
1. `Realtime Database` → `Créer une base de données`
2. Mode : **Test** (pour développement)
3. Région : **europe-west1**

### **Étape 3 : Copier les Credentials**

1. Dans Firebase Console : `Paramètres du projet` ⚙️
2. Section **"Vos applications"** → Web (</>) 
3. Copiez la configuration `firebaseConfig`
4. Remplacez dans `/src/app/config/firebase.ts` :

```typescript
const firebaseConfig = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "VOTRE_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://VOTRE_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "VOTRE_PROJECT_ID",
  storageBucket: "VOTRE_PROJECT_ID.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId: "VOTRE_APP_ID"
};
```

### **Étape 4 : Règles de Sécurité**

#### **Firestore Rules** :
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

#### **Realtime Database Rules** :
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    "sensors": {
      ".indexOn": ["timestamp"]
    }
  }
}
```

### **Étape 5 : Activer Firebase dans l'App**

1. Connectez-vous à la plateforme
2. Allez dans **Paramètres** (`/settings`)
3. Activez le switch **Firebase**
4. 🎉 Vous utilisez maintenant Firebase !

---

## 📊 **Structure des Données**

### **Realtime Database** (Capteurs temps réel)
```
sensors/
  └── current/
      ├── timestamp
      ├── voltageDivider/
      ├── currentShunt/
      ├── ds18b20/
      ├── bh1750/
      ├── esp32/
      └── calculated/
```

### **Firestore** (Historique & Alertes)

#### Collection : `sensorHistory`
```typescript
{
  id: auto,
  timestamp: string,
  voltageDivider: {...},
  currentShunt: {...},
  ds18b20: {...},
  bh1750: {...},
  esp32: {...},
  calculated: {...},
  createdAt: serverTimestamp
}
```

#### Collection : `alerts`
```typescript
{
  id: auto,
  type: 'critical' | 'warning' | 'info',
  message: string,
  sensor: string,
  value: number,
  threshold: number,
  timestamp: serverTimestamp,
  resolved: boolean
}
```

#### Collection : `dailyStats`
```typescript
{
  id: auto,
  totalEnergy24h: number,
  efficiency: number,
  revenue: string,
  date: string,
  createdAt: serverTimestamp
}
```

---

## 🔄 **Modes de Fonctionnement**

### **Mode 1 : Local (Par défaut)**
- ✅ Pas de connexion Internet requise
- ✅ Données mock (simulation ESP32)
- ✅ Authentification locale
- ✅ Parfait pour développement

### **Mode 2 : Firebase**
- ✅ Données cloud temps réel
- ✅ Firebase Authentication
- ✅ Persistance des données
- ✅ Multi-utilisateurs
- ✅ Synchronisation ESP32 → Firebase

---

## 🚀 **Utilisation avec ESP32 Réel**

### **Code Arduino/ESP32** :

```cpp
#include <WiFi.h>
#include <FirebaseESP32.h>

FirebaseData firebaseData;
FirebaseAuth auth;
FirebaseConfig config;

void setup() {
  // Configuration WiFi
  WiFi.begin("VOTRE_SSID", "VOTRE_PASSWORD");
  
  // Configuration Firebase
  config.api_key = "VOTRE_API_KEY";
  config.database_url = "VOTRE_DATABASE_URL";
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {
  // Lire capteurs
  float temp = readDS18B20();
  float lux = readBH1750();
  float voltage = readVoltage();
  float current = readCurrent();
  
  // Envoyer à Firebase
  Firebase.setFloat(firebaseData, "/sensors/current/ds18b20/temperature", temp);
  Firebase.setFloat(firebaseData, "/sensors/current/bh1750/lux", lux);
  Firebase.setFloat(firebaseData, "/sensors/current/voltageDivider/voltage", voltage);
  Firebase.setFloat(firebaseData, "/sensors/current/currentShunt/current", current);
  
  delay(3000); // Mise à jour toutes les 3 secondes
}
```

---

## 📈 **Avantages Firebase**

### ✅ **Simplicité**
- Pas de backend à coder
- Configuration en quelques minutes
- SDK prêt à l'emploi

### ✅ **Temps Réel**
- Synchronisation instantanée
- WebSocket automatique
- Listeners réactifs

### ✅ **Scalabilité**
- Gratuit jusqu'à 100 utilisateurs simultanés
- Hébergement Firebase (gratuit)
- CDN mondial

### ✅ **Sécurité**
- Authentication intégrée
- Règles de sécurité
- SSL/TLS automatique

### ✅ **Gratuit**
- Plan Spark (gratuit)
- 1 GB stockage Firestore
- 10 GB Realtime Database
- 100K lectures/jour

---

## 🎓 **API Firebase Utilisée**

### **Authentication**
```typescript
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
```

### **Realtime Database**
```typescript
import { ref, onValue, set } from 'firebase/database';
```

### **Firestore**
```typescript
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
```

---

## 🔐 **Sécurité**

### **Authentification obligatoire**
- Tous les utilisateurs doivent être connectés
- RBAC : Admin / Technicien / User

### **Règles Firebase**
- Lecture/Écriture uniquement si authentifié
- Les données sont protégées

### **Credentials**
- **NE JAMAIS** committer `firebase.ts` avec de vrais credentials
- Utilisez des variables d'environnement en production

---

## 🌐 **Test en Production**

### **1. Déployez sur Firebase Hosting**
```bash
npm run build
firebase login
firebase init hosting
firebase deploy
```

### **2. URL de production**
```
https://solarwatch-tunisia.web.app
```

---

## 📱 **Intégration Future**

### **Mobile App** (React Native)
- Même Firebase project
- Code partagé
- Notifications push

### **ESP32 → Firebase**
- Envoi direct des capteurs
- Pas de serveur intermédiaire

### **Dashboard Admin Web**
- Gestion utilisateurs
- Configuration à distance
- Rapports automatiques

---

## 🇹🇳 **Spécificités Tunisie**

### **Région optimale** : `europe-west1` (Belgique)
- Latence ~40-60ms depuis Tunisie
- Meilleur choix pour l'Afrique du Nord

### **Monnaie** : TND
- Calculs de revenus en Dinars Tunisiens
- Tarif électricité STEG

### **Localisation** : `fr-TN`
- Dates en français
- Format tunisien

---

## 📊 **Métriques**

| Service | Limite Gratuite | Usage Estimé |
|---------|-----------------|--------------|
| **Authentication** | 50K MAU | ~100 users |
| **Firestore** | 50K reads/day | ~10K/day |
| **Realtime DB** | 100K simultané | 1-10 |
| **Hosting** | 10 GB/mois | ~1 GB |

---

## 🎯 **Prochaines Étapes**

1. ✅ Configurer votre projet Firebase
2. ✅ Remplacer les credentials
3. ✅ Créer les utilisateurs test
4. ✅ Activer Firebase dans Settings
5. ✅ Connecter votre ESP32 réel

---

**Date** : 8 Mars 2026  
**Projet** : SolarWatch IoT + Firebase  
**Statut** : ✅ **BACKEND PRÊT**  
**Mode** : 🔄 Local ↔️ Firebase (Toggle)
