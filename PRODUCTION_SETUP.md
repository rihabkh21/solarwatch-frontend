# 🚀 Production Setup Guide - SolarWatch

## 🔑 Credentials Firebase

### Comptes Actifs (Firebase Auth)

| Email | Rôle | Accès |
|-------|------|-------|
| admin@solarwatch.tn | Admin | Complet |
| tech@solarwatch.tn | Technicien | Limité |
| user@solarwatch.tn | User | Lecture |

> Mot de passe admin : `admin123`

---

## 🏗️ Architecture de Production
ESP32-WROOM-32U
↓ MQTT (HiveMQ WSS:8884)
Node.js Bridge (mqtt-bridge/index.js)
↓                    ↓
XGBoost API          Firebase Admin SDK
(Flask:5000)         ↓           ↓
Classification   Realtime DB   Firestore
Normal/Panne     (live data)   (historique)
↓
React Frontend (Vite:5173)

---

## 🚀 Démarrage

### Développement Local (4 terminaux)

```bash
# Terminal 1 — Emulateur Firebase Functions
cd C:\Users\asus\Desktop\pfer1
npx firebase-tools emulators:start --only functions

# Terminal 2 — MQTT Bridge
cd C:\Users\asus\Desktop\mqtt-bridge
node index.js

# Terminal 3 — API XGBoost ML
cd C:\Users\asus\Desktop\mqtt-bridge\ml
python app.py

# Terminal 4 — Frontend React
cd C:\Users\asus\Desktop\pfer1
npm run dev
```

### Test MQTT (sans ESP32)
Aller sur https://www.hivemq.com/demos/websocket-client/
- Host: `broker.hivemq.com` | Port: `8884` | SSL: ✅
- Topic: `solarwatch/ESP32_001/data`

---

## 🔐 RBAC — Contrôle d'Accès

### Admin (`admin@solarwatch.tn`)
- ✅ Dashboard, Surveillance, IA
- ✅ Alertes, Interventions, Historique
- ✅ Admin, Users, Panneaux
- ✅ Config, Hardware, Rapports, Paramètres

### Technicien (`tech@solarwatch.tn`)
- ✅ Dashboard, Surveillance, IA
- ✅ Alertes, Interventions, Historique
- ❌ Admin, Users, Panneaux, Config

### User (`user@solarwatch.tn`)
- ✅ Dashboard (panneaux assignés uniquement)
- ✅ Historique, Paramètres
- ❌ Tout le reste

---

## ⚙️ Configuration Firebase

### Projet
- **ID** : `solarwatch-8c68a`
- **Auth** : Email/Password ✅
- **Firestore** : Activé ✅
- **Realtime DB** : Activé ✅
- **Functions** : Émulateur local (plan Blaze requis pour production)

### Variables d'Environnement (.env)
```dotenv
VITE_FIREBASE_API_KEY=AIzaSyD5kDTdN3ZwiKV-lS3f6dHcJs-xOpD3nu8
VITE_FIREBASE_AUTH_DOMAIN=solarwatch-8c68a.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://solarwatch-8c68a-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=solarwatch-8c68a
VITE_FIREBASE_STORAGE_BUCKET=solarwatch-8c68a.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=950107235339
VITE_FIREBASE_APP_ID=1:950107235339:web:7d983db9c6c438bb91930e
VITE_FIREBASE_MEASUREMENT_ID=G-W4TPVMR8HS
VITE_FIREBASE_FUNCTIONS_BASE_URL=http://127.0.0.1:5001/solarwatch-8c68a/europe-west1/api
VITE_FIREBASE_FUNCTIONS_API_ENDPOINT=http://127.0.0.1:5001/solarwatch-8c68a/europe-west1/api/sensor-data
```

### Security Rules Firestore
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /panels/{panelId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /alerts/{alertId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /sensorHistory/{docId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    match /settings/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /interventions/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /activities/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

### Security Rules Realtime Database
```json
{
  "rules": {
    "sensors": {
      ".read": "auth != null",
      ".write": true
    }
  }
}
```

---

## 🤖 Intelligence Artificielle

### Modèles XGBoost

| Fichier | Type | Performance |
|---------|------|-------------|
| `model.joblib` | Classification Normal/Panne | Accuracy: 75.92% |
| `modelregression.joblib` | Régression Puissance (W) | R²: 0.9998, MAE: 0.2183 |

### Features
irradiance (W/m²) | temperature (°C) | voltage (V) | current (A)

### API Endpoints (localhost:5000)
GET  /health    → Statut modèles
POST /predict   → Classification (Normal/Panne)
POST /forecast  → Puissance prévue (W)
POST /analyze   → Classification + Régression

---

## 📡 ESP32 Configuration

```cpp
// ESP32_FIREBASE_CODE.ino
const char* WIFI_SSID      = "VOTRE_WIFI";
const char* WIFI_PASSWORD  = "VOTRE_PASSWORD";
const char* FIREBASE_HOST  = "https://solarwatch-8c68a-default-rtdb.firebaseio.com";
const char* MQTT_ENDPOINT  = "https://europe-west1-solarwatch-8c68a.cloudfunctions.net/api/sensor-data";
const char* DEVICE_ID      = "ESP32_001";
const int   SEND_INTERVAL  = 3000; // ms
```

### Capteurs
| Capteur | Interface | GPIO |
|---------|-----------|------|
| DS18B20 (Température) | 1-Wire | GPIO 4 |
| BH1750 (Luminosité) | I2C | SDA:21, SCL:22 |
| Pont diviseur (Tension) | ADC | GPIO 34 |
| Shunt (Courant) | ADC | GPIO 35 |

---

## 🏭 Build de Production

```bash
# Build
npm run build

# Déployer sur Firebase Hosting
npx firebase-tools deploy --only hosting

# Déployer les Functions (plan Blaze requis)
npx firebase-tools deploy --only functions

# Déployer les règles
npm run deploy:rules
```

---

## 🌐 Options de Déploiement

| Service | Commande | Notes |
|---------|----------|-------|
| Firebase Hosting | `firebase deploy --only hosting` | Recommandé |
| Vercel | `vercel --prod` | Simple |
| Netlify | Drag & Drop `/dist` | Simple |

---

## ⚠️ Sécurité

1. **Ne jamais committer `.env`** — déjà dans `.gitignore`
2. **Security Rules** configurées sur Firebase Console
3. **Admin SDK** uniquement dans `mqtt-bridge/` (serviceAccount.json)
4. **MQTT** sur broker public HiveMQ — pour production utiliser HiveMQ Cloud privé
5. **XGBoost API** sur localhost — pour production déployer sur serveur sécurisé

---

## ✅ Checklist Production

- [x] Firebase `solarwatch-8c68a` configuré
- [x] Auth Email/Password activée
- [x] Firestore + Realtime DB opérationnelles
- [x] Security Rules publiées
- [x] 3 utilisateurs créés (admin/tech/user)
- [x] Panneaux P1/P2/P3 dans Firestore
- [x] MQTT Bridge → Firebase fonctionnel
- [x] XGBoost API (R²=0.9998) opérationnelle
- [x] Frontend React connecté Firebase Live
- [x] Interface IA avec détection anomalies temps réel
- [ ] Plan Blaze Firebase (Functions production)
- [ ] ESP32 physique branché et configuré
- [ ] HiveMQ Cloud privé (production)
- [ ] Serveur Flask sécurisé (production)

---

**🎉 SolarWatch IoT Platform — Opérationnelle !**

> ESP32 → MQTT → XGBoost → Firebase → React