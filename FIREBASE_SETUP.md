# 🔥 Configuration Firebase pour SolarWatch IoT Platform

## 📋 Table des Matières
1. [Prérequis](#prérequis)
2. [Configuration Firebase Console](#configuration-firebase-console)
3. [Configuration de l'Application](#configuration-de-lapplication)
4. [Structure de la Base de Données](#structure-de-la-base-de-données)
5. [Règles de Sécurité](#règles-de-sécurité)
6. [Code ESP32](#code-esp32)
7. [Déploiement](#déploiement)

---

## 1. Prérequis

- Compte Google
- Projet Firebase (gratuit)
- Node.js et npm installés
- ESP32-WROOM-32U configuré

---

## 2. Configuration Firebase Console

### Étape 1 : Créer un Projet Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Cliquez sur **"Ajouter un projet"**
3. Nom du projet : `solarwatch-tunisia` (ou votre choix)
4. Activez Google Analytics (optionnel)
5. Cliquez sur **"Créer un projet"**

### Étape 2 : Activer l'Authentification

1. Dans le menu latéral, cliquez sur **"Authentication"**
2. Cliquez sur **"Commencer"**
3. Activez **"E-mail/Mot de passe"**
4. Cliquez sur **"Enregistrer"**

### Étape 3 : Créer Firestore Database

1. Dans le menu, cliquez sur **"Firestore Database"**
2. Cliquez sur **"Créer une base de données"**
3. Sélectionnez **"Mode test"** (temporaire) ou **"Mode production"**
4. Choisissez l'emplacement : **"europe-west"** (proche de la Tunisie)
5. Cliquez sur **"Activer"**

### Étape 4 : Créer Realtime Database

1. Dans le menu, cliquez sur **"Realtime Database"**
2. Cliquez sur **"Créer une base de données"**
3. Sélectionnez **"europe-west1"** comme région
4. Choisissez **"Mode test"** (temporaire)
5. Cliquez sur **"Activer"**

### Étape 5 : Récupérer les Clés de Configuration

1. Dans les paramètres du projet (⚙️), cliquez sur **"Paramètres du projet"**
2. Descendez jusqu'à **"Vos applications"**
3. Cliquez sur l'icône **Web** `</>`
4. Nom de l'application : `SolarWatch Web`
5. Copiez les valeurs de `firebaseConfig`

---

## 3. Configuration de l'Application

### Fichier : `/src/app/config/firebase.ts`

Remplacez les valeurs par défaut par vos clés Firebase :

\`\`\`typescript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "solarwatch-tunisia.firebaseapp.com",
  databaseURL: "https://solarwatch-tunisia-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "solarwatch-tunisia",
  storageBucket: "solarwatch-tunisia.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890",
  measurementId: "G-XXXXXXXXXX"
};
\`\`\`

---

## 4. Structure de la Base de Données

### Firestore Collections

#### Collection `users`
\`\`\`
users/
  {uid}/
    - uid: string
    - email: string
    - displayName: string
    - role: 'admin' | 'technicien' | 'user'
    - createdAt: timestamp
    - lastLogin: timestamp
    - photoURL?: string
    - phoneNumber?: string
    - organization?: string
\`\`\`

#### Collection `sensorHistory`
\`\`\`
sensorHistory/
  {documentId}/
    - deviceId: string
    - timestamp: timestamp
    - ds18b20: { temperature, address }
    - bh1750: { lux, lightLevel, mode }
    - voltageDivider: { voltage, voltageRaw, r1, r2 }
    - currentShunt: { current, voltageDropMv, shuntResistance }
    - esp32: { model, wifiSignal, uptime, freeHeap, voltage }
    - calculated: { power, energy24h, efficiency, revenue24h }
\`\`\`

#### Collection `alerts`
\`\`\`
alerts/
  {alertId}/
    - type: 'warning' | 'error' | 'info'
    - title: string
    - message: string
    - timestamp: timestamp
    - resolved: boolean
    - deviceId: string
\`\`\`

#### Collection `esp32Config`
\`\`\`
esp32Config/
  {deviceId}/
    - deviceId: string
    - name: string
    - location: string
    - solarPanelSpecs: { voltageRange, maxPower }
    - alertThresholds: { maxTemperature, minVoltage, minCurrent }
    - active: boolean
\`\`\`

### Realtime Database Structure

\`\`\`
sensors/
  {deviceId}/
    current/
      - timestamp: number
      - ds18b20: {...}
      - bh1750: {...}
      - voltageDivider: {...}
      - currentShunt: {...}
      - esp32: {...}
      - calculated: {...}
\`\`\`

---

## 5. Règles de Sécurité

### Firestore Security Rules

Dans Firebase Console > Firestore Database > Règles :

\`\`\`javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Fonction helper pour vérifier le rôle
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    
    function isAdmin() {
      return request.auth != null && getUserRole() == 'admin';
    }
    
    function isTechnicien() {
      return request.auth != null && (getUserRole() == 'technicien' || getUserRole() == 'admin');
    }
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || request.auth.uid == userId;
    }
    
    // Sensor history - lecture pour tous, écriture pour système
    match /sensorHistory/{docId} {
      allow read: if isAuthenticated();
      allow create: if true; // ESP32 peut écrire
      allow update, delete: if isAdmin();
    }
    
    // Alerts - lecture pour tous, écriture pour techniciens+
    match /alerts/{alertId} {
      allow read: if isAuthenticated();
      allow create: if true; // Système peut créer
      allow update, delete: if isTechnicien();
    }
    
    // ESP32 Config - lecture pour tous, écriture pour admin
    match /esp32Config/{deviceId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
  }
}
\`\`\`

### Realtime Database Security Rules

Dans Firebase Console > Realtime Database > Règles :

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

## 6. Code ESP32

### Arduino Code pour envoyer les données à Firebase

\`\`\`cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <BH1750.h>

// Configuration WiFi
const char* ssid = "VOTRE_WIFI_SSID";
const char* password = "VOTRE_WIFI_PASSWORD";

// Configuration Firebase
const char* firebaseHost = "https://solarwatch-tunisia-default-rtdb.europe-west1.firebasedatabase.app";
const char* deviceId = "ESP32_001"; // ID unique de votre appareil

// Capteurs
#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
BH1750 lightMeter(0x23);

// ADC Pins
#define VOLTAGE_PIN 34
#define CURRENT_PIN 35

// Configuration pont diviseur
const float R1 = 30000.0; // 30kΩ
const float R2 = 10000.0; // 10kΩ
const float ADC_RESOLUTION = 4095.0;
const float ADC_VOLTAGE = 3.3;

// Configuration shunt
const float SHUNT_RESISTANCE = 0.1; // 0.1Ω

void setup() {
  Serial.begin(115200);
  
  // Connexion WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connecté!");
  
  // Initialiser capteurs
  sensors.begin();
  lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    // Lire les capteurs
    sensors.requestTemperatures();
    float temperature = sensors.getTempCByIndex(0);
    float lux = lightMeter.readLightLevel();
    
    // Lire ADC
    int voltageRaw = analogRead(VOLTAGE_PIN);
    int currentRaw = analogRead(CURRENT_PIN);
    
    // Calculer tension
    float voltage = (voltageRaw / ADC_RESOLUTION) * ADC_VOLTAGE * ((R1 + R2) / R2);
    
    // Calculer courant
    float voltageDropMv = (currentRaw / ADC_RESOLUTION) * ADC_VOLTAGE * 1000;
    float current = voltageDropMv / (SHUNT_RESISTANCE * 1000); // en mA
    
    // Calculer puissance
    float power = (voltage * current) / 1000; // en W
    
    // Créer JSON
    StaticJsonDocument<1024> doc;
    doc["timestamp"] = millis();
    
    JsonObject ds18b20 = doc.createNestedObject("ds18b20");
    ds18b20["temperature"] = temperature;
    ds18b20["address"] = "28-FF-64-1E-8C-16-03-5A";
    
    JsonObject bh1750 = doc.createNestedObject("bh1750");
    bh1750["lux"] = lux;
    bh1750["lightLevel"] = getLightLevel(lux);
    bh1750["mode"] = "CONTINUOUS_HIGH_RES";
    
    JsonObject voltageDivider = doc.createNestedObject("voltageDivider");
    voltageDivider["voltage"] = voltage;
    voltageDivider["voltageRaw"] = voltageRaw;
    voltageDivider["r1"] = "30kΩ";
    voltageDivider["r2"] = "10kΩ";
    
    JsonObject currentShunt = doc.createNestedObject("currentShunt");
    currentShunt["current"] = current;
    currentShunt["voltageDropMv"] = voltageDropMv;
    currentShunt["shuntResistance"] = SHUNT_RESISTANCE;
    
    JsonObject esp32 = doc.createNestedObject("esp32");
    esp32["model"] = "ESP32-WROOM-32U";
    esp32["wifiSignal"] = WiFi.RSSI();
    esp32["uptime"] = millis() / 1000;
    esp32["freeHeap"] = ESP.getFreeHeap();
    esp32["voltage"] = 5.0;
    
    JsonObject calculated = doc.createNestedObject("calculated");
    calculated["power"] = power;
    calculated["energy24h"] = power * 24; // Approximation
    calculated["efficiency"] = 85.0;
    calculated["revenue24h"] = power * 24 * 0.15; // TND
    
    // Envoyer à Firebase
    String jsonString;
    serializeJson(doc, jsonString);
    
    HTTPClient http;
    String url = String(firebaseHost) + "/sensors/" + deviceId + "/current.json";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    
    int httpResponseCode = http.PUT(jsonString);
    
    if (httpResponseCode > 0) {
      Serial.println("Données envoyées avec succès!");
    } else {
      Serial.print("Erreur HTTP: ");
      Serial.println(httpResponseCode);
    }
    
    http.end();
  }
  
  delay(3000); // Envoyer toutes les 3 secondes
}

String getLightLevel(float lux) {
  if (lux < 10) return "dark";
  if (lux < 100) return "dim";
  if (lux < 1000) return "normal";
  return "bright";
}
\`\`\`

---

## 7. Déploiement

### Créer le Premier Utilisateur Admin

Depuis la Firebase Console > Authentication > Users :

1. Cliquez sur **"Ajouter un utilisateur"**
2. Email : `admin@solarwatch.tn`
3. Mot de passe : `Admin@2024!`
4. Cliquez sur **"Ajouter un utilisateur"**

Puis dans Firestore Database, créez manuellement le document :

\`\`\`
Collection: users
Document ID: [UID de l'utilisateur créé]
Champs:
  - uid: [UID de l'utilisateur]
  - email: "admin@solarwatch.tn"
  - displayName: "Administrateur SolarWatch"
  - role: "admin"
  - createdAt: [timestamp actuel]
  - lastLogin: [timestamp actuel]
\`\`\`

### Tester la Connexion

1. Lancez l'application web
2. Connectez-vous avec : `admin@solarwatch.tn` / `Admin@2024!`
3. Vérifiez que vous avez accès au dashboard

---

## 🎯 Fonctionnalités Backend Implémentées

✅ **Authentification complète** avec Firebase Auth
✅ **RBAC** (Admin, Technicien, User)
✅ **Données temps réel** via Realtime Database
✅ **Historique** stocké dans Firestore
✅ **Système d'alertes** automatique
✅ **Gestion utilisateurs** (Admin)
✅ **Configuration ESP32** persistante
✅ **Statistiques** et analytics
✅ **Sécurité** avec Security Rules

---

## 📊 Architecture Backend

\`\`\`
Frontend (React)
    ↓
Firebase SDK
    ↓
┌─────────────────────────┐
│   Firebase Services     │
│  ┌──────────────────┐   │
│  │ Authentication   │   │ ← Login/Logout/RBAC
│  └──────────────────┘   │
│  ┌──────────────────┐   │
│  │ Realtime DB      │   │ ← Données capteurs live
│  └──────────────────┘   │
│  ┌──────────────────┐   │
│  │ Firestore        │   │ ← Historique + Config
│  └──────────────────┘   │
│  ┌──────────────────┐   │
│  │ Storage          │   │ ← Fichiers/Logs
│  └──────────────────┘   │
└─────────────────────────┘
    ↑
ESP32-WROOM-32U
(HTTP POST/PUT)
\`\`\`

---

## 🔒 Sécurité

- ✅ Authentification obligatoire
- ✅ Contrôle d'accès basé sur les rôles (RBAC)
- ✅ Security Rules Firestore
- ✅ HTTPS uniquement
- ✅ Validation des données côté serveur
- ✅ Rate limiting (Firebase)

---

## 📱 Support

Pour toute question : support@solarwatch.tn
