# ⚡ Firebase Backend - Guide Démarrage Rapide

## 🎯 En 5 Minutes

### Étape 1 : Créer un Projet Firebase (2 min)

1. Allez sur https://console.firebase.google.com/
2. Cliquez **"Ajouter un projet"**
3. Nom : `solarwatch-tunisia`
4. Désactiver Google Analytics (optionnel)
5. Cliquez **"Créer un projet"**

### Étape 2 : Activer les Services (1 min)

**A. Authentication**
- Menu > Authentication > Commencer
- Activer **"E-mail/Mot de passe"**

**B. Firestore Database**
- Menu > Firestore Database > Créer une base de données
- Mode : **Test** (pour commencer)
- Région : **europe-west** (proche Tunisie)

**C. Realtime Database**
- Menu > Realtime Database > Créer une base de données
- Région : **europe-west1**
- Mode : **Test**

### Étape 3 : Récupérer les Clés (1 min)

1. Icône ⚙️ > Paramètres du projet
2. Section "Vos applications" > Icône Web `</>`
3. Nom : `SolarWatch Web`
4. **Copier tout le bloc `firebaseConfig`**

### Étape 4 : Configurer l'App (30 sec)

Ouvrez `/src/app/config/firebase.ts` et collez vos clés :

\`\`\`typescript
const firebaseConfig = {
  apiKey: "COLLEZ_ICI",
  authDomain: "COLLEZ_ICI",
  databaseURL: "COLLEZ_ICI",
  projectId: "COLLEZ_ICI",
  storageBucket: "COLLEZ_ICI",
  messagingSenderId: "COLLEZ_ICI",
  appId: "COLLEZ_ICI"
};
\`\`\`

### Étape 5 : Créer l'Admin (30 sec)

**Dans Firebase Console :**

1. Authentication > Users > **Add user**
   - Email : `admin@solarwatch.tn`
   - Password : `Admin@2024!`
   - Cliquez **Add user**
   - **NOTEZ L'UID** (ex: `xK7vJ2P...`)

2. Firestore Database > **Commencer une collection**
   - ID collection : `users`
   - ID document : **Collez l'UID noté**
   - Champs :
     - `uid` (string) : [Même UID]
     - `email` (string) : `admin@solarwatch.tn`
     - `displayName` (string) : `Admin SolarWatch`
     - `role` (string) : `admin`
     - `createdAt` (timestamp) : [Cliquez horloge, Now]
     - `lastLogin` (timestamp) : [Cliquez horloge, Now]

---

## ✅ C'est Prêt !

### Tester Maintenant :

1. **Lancez l'app** et connectez-vous :
   - Email : `admin@solarwatch.tn`
   - Password : `Admin@2024!`

2. **Testez avec des données simulées** (Console navigateur F12) :
   \`\`\`javascript
   firebaseUtils.initializeFirebaseDemo()
   firebaseUtils.startDataSimulator()
   \`\`\`

3. **Visualisez les données** :
   - Naviguez vers n'importe quelle page
   - Les données s'affichent en temps réel !

---

## 🔒 Sécuriser (Important pour Production)

### Firestore Rules

Firebase Console > Firestore > Rules (remplacez tout) :

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
    
    function isTechnicien() {
      return request.auth != null && (getUserRole() == 'technicien' || getUserRole() == 'admin');
    }
    
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if isAdmin() || request.auth.uid == userId;
    }
    
    match /sensorHistory/{docId} {
      allow read: if request.auth != null;
      allow create: if true;
      allow update, delete: if isAdmin();
    }
    
    match /alerts/{alertId} {
      allow read: if request.auth != null;
      allow create: if true;
      allow update, delete: if isTechnicien();
    }
    
    match /esp32Config/{deviceId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
  }
}
\`\`\`

### Realtime Database Rules

Firebase Console > Realtime Database > Rules :

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

Cliquez **"Publier"** pour chaque règle.

---

## 🔌 Connecter l'ESP32 (Optionnel)

### 1. Installer les Bibliothèques Arduino

Dans Arduino IDE > Gestionnaire de bibliothèques :
- `ArduinoJson` by Benoit Blanchon
- `OneWire` by Paul Stoffregen
- `DallasTemperature` by Miles Burton
- `BH1750` by Christopher Laws

### 2. Modifier le Code

Ouvrez `/ESP32_FIREBASE_CODE.ino` et modifiez :

\`\`\`cpp
// WiFi
const char* WIFI_SSID = "VotreWiFi";
const char* WIFI_PASSWORD = "VotreMotDePasse";

// Firebase (copiez depuis firebase.ts)
const char* FIREBASE_HOST = "https://votre-projet.firebasedatabase.app";

// ID unique de votre ESP32
const char* DEVICE_ID = "ESP32_001";
\`\`\`

### 3. Téléverser

1. Branchez l'ESP32 en USB
2. Sélectionnez la carte : **ESP32 Dev Module**
3. Sélectionnez le port
4. Cliquez **Téléverser**

### 4. Vérifier

Ouvrez le **Moniteur série** (115200 baud) :
- Doit afficher "✅ Envoi Firebase réussi"
- Dans l'app web, les données doivent apparaître !

---

## 🎉 Félicitations !

Votre backend Firebase est opérationnel !

### Prochaines Étapes :

1. ✅ Créer d'autres utilisateurs (Technicien, User)
2. ✅ Configurer les seuils d'alerte
3. ✅ Connecter plusieurs ESP32
4. ✅ Analyser l'historique
5. ✅ Déployer en production

---

## 📚 Documentation Complète

- 📖 [README_FIREBASE.md](/README_FIREBASE.md) - Guide complet
- 📖 [FIREBASE_SETUP.md](/FIREBASE_SETUP.md) - Configuration détaillée
- 📖 [BACKEND_ARCHITECTURE.md](/BACKEND_ARCHITECTURE.md) - Architecture technique

---

## 🆘 Besoin d'Aide ?

### Problèmes Communs :

**❌ "Permission denied"**
→ Vérifiez les Security Rules

**❌ "User not found"**
→ Créez le profil dans Firestore

**❌ "Network error"**
→ Vérifiez les clés dans `firebase.ts`

**❌ Pas de données en temps réel**
→ Testez avec `firebaseUtils.startDataSimulator()`

---

## 💡 Astuce Pro

Utilisez la console navigateur (F12) :

\`\`\`javascript
// Voir tous les utilitaires disponibles
firebaseUtils

// Envoyer des données de test
firebaseUtils.sendMockSensorData()

// Démarrer le simulateur
firebaseUtils.startDataSimulator()

// Configuration complète
firebaseUtils.initializeFirebaseDemo()
\`\`\`

---

**🚀 Bon développement avec SolarWatch !**
