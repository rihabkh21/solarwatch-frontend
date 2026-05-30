const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const mqtt = require("mqtt");

admin.initializeApp({
  databaseURL: "https://solarwatch-8c68a-default-rtdb.firebaseio.com"
});

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

if (process.env.FUNCTIONS_EMULATOR) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  process.env.FIREBASE_DATABASE_EMULATOR_HOST = "127.0.0.1:9000";
}

const db = admin.firestore();
const rtdb = admin.database();

const MAX_SENSOR_HISTORY = 500;

// ========================================
// MQTT → FIREBASE BRIDGE
// ========================================

/**
 * Transforme le payload ESP32 (format plat) vers le format Firebase structuré
 * ESP32 envoie: { temperature, lux, lightLevel, voltage, current, power, energy, ... }
 * Firebase stocke: { ds18b20: {temperature}, bh1750: {lux}, ... }
 */
function transformESP32Payload(raw) {
  const deviceId = raw.deviceId || "ESP32_001";
  const now = Date.now();

  return {
    deviceId,
    serverTimestamp: now,
    receivedAt: new Date(now).toISOString(),

    // DS18B20
    ds18b20: {
      temperature: raw.temperature ?? 0,
      address:     raw.ds18b20Address ?? "",
    },

    // BH1750
    bh1750: {
      lux:        raw.lux        ?? 0,
      lightLevel: raw.lightLevel ?? "normal",
      mode:       "Continuous High Res Mode",
    },

    // Pont diviseur tension
    voltageDivider: {
      voltage:    raw.voltage    ?? 0,
      voltageRaw: raw.voltageRaw ?? 0,
      r1:         "30kΩ",
      r2:         "10kΩ",
    },

    // ACS712 courant
    acs712: {
      current:     raw.current     ?? 0,   // mA
      rawVoltage:  raw.currentRaw  ?? 0,
      sensitivity: 185,
      model:       "ACS712-5A",
    },

    // Calculé
    calculated: {
      power:      raw.power      ?? 0,
      energy24h:  (raw.energy    ?? 0) * 1000,  // Wh → convertir si besoin
      efficiency: raw.efficiency ?? 0,
    },

    // Système ESP32
    esp32: {
      model:      "ESP32-WROOM-32U",
      wifiSignal: raw.wifiRSSI  ?? 0,
      uptime:     raw.uptime    ?? 0,
      freeHeap:   raw.freeHeap  ?? 0,
      voltage:    5.0,
    },
  };
}

async function saveSensorReading(structured) {
  const deviceId = structured.deviceId;

  // → Realtime Database (current)
  try {
    await rtdb.ref(`sensors/${deviceId}/current`).set(structured);
    console.log(`✅ RTDB OK [${deviceId}]`);
  } catch (err) {
    console.error("❌ RTDB error:", err.message);
  }

  // → Firestore historique
  try {
    await db.collection("sensorHistory").add({
      ...structured,
      timestamp: new Date(),
    });
    console.log(`✅ Firestore OK [${deviceId}]`);
  } catch (err) {
    console.error("❌ Firestore error:", err.message);
  }

  // Nettoyage si > MAX_SENSOR_HISTORY
  try {
    const old = await db
      .collection("sensorHistory")
      .where("deviceId", "==", deviceId)
      .orderBy("timestamp", "desc")
      .offset(MAX_SENSOR_HISTORY)
      .get();
    if (!old.empty) {
      const batch = db.batch();
      old.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  } catch (_) {}
}

// ── MQTT Bridge (lancé au démarrage de la Cloud Function) ─────────────────────
let mqttClient = null;

function startMQTTBridge() {
  if (mqttClient) return; // déjà connecté

  console.log("🔌 Connexion MQTT → broker.hivemq.com...");

  mqttClient = mqtt.connect("mqtt://broker.hivemq.com:1883", {
    clientId:      `solarwatch-bridge-${Date.now()}`,
    clean:         true,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  });

  mqttClient.on("connect", () => {
    console.log("✅ MQTT connecté");
    // S'abonner à tous les panneaux ESP32
    mqttClient.subscribe("solarwatch/+/data", { qos: 0 }, (err) => {
      if (err) console.error("❌ Subscribe error:", err.message);
      else console.log("✅ Abonné à solarwatch/+/data");
    });
  });

  mqttClient.on("message", async (topic, message) => {
    try {
      console.log(`📨 MQTT reçu: ${topic} [${message.length} bytes]`);
      const raw = JSON.parse(message.toString());

      // Extraire deviceId depuis le topic: solarwatch/ESP32_001/data
      const parts = topic.split("/");
      if (parts.length >= 2) {
        raw.deviceId = raw.deviceId || parts[1];
      }

      const structured = transformESP32Payload(raw);
      await saveSensorReading(structured);
    } catch (err) {
      console.error("❌ MQTT message error:", err.message);
    }
  });

  mqttClient.on("error", (err) => {
    console.error("❌ MQTT error:", err.message);
  });

  mqttClient.on("reconnect", () => {
    console.log("🔄 MQTT reconnexion...");
  });
}

// Démarrer le bridge MQTT dès que la fonction démarre
startMQTTBridge();

// ========================================
// AUTH HELPERS
// ========================================

async function readBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

async function requireAuth(req, res, next) {
  try {
    const token = await readBearerToken(req);
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (_err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const token = await readBearerToken(req);
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const decoded = await admin.auth().verifyIdToken(token);
    const claimRole = decoded.role;
    const userDoc = await db.collection("users").doc(decoded.uid).get();
    const userRole = userDoc.exists ? userDoc.data()?.role : undefined;
    const role = claimRole || userRole;
    if (role !== "admin") return res.status(403).json({ error: "Forbidden" });
    req.user = decoded;
    next();
  } catch (_err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

// ========================================
// HEALTH
// ========================================

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    mqtt: mqttClient?.connected ? "connected" : "disconnected",
  });
});

// ========================================
// AUTH
// ========================================

app.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const authUser = await admin.auth().getUser(req.user.uid);
    const userDoc = await db.collection("users").doc(req.user.uid).get();
    const role = authUser.customClaims?.role || userDoc.data()?.role || "user";
    res.json({
      id: authUser.uid,
      email: authUser.email || null,
      name: authUser.displayName || userDoc.data()?.displayName || userDoc.data()?.name || null,
      role,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/auth/signup", requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }
    const created = await admin.auth().createUser({
      email, password, displayName: name || "", emailVerified: true,
    });
    const normalizedRole = role || "user";
    await admin.auth().setCustomUserClaims(created.uid, { role: normalizedRole });
    await db.collection("users").doc(created.uid).set({
      uid: created.uid, email, displayName: name || "",
      role: normalizedRole, createdAt: new Date(), lastLogin: new Date(),
    });
    res.json({ user: { id: created.uid, email: created.email } });
  } catch (err) {
    res.status(400).json({ error: err.message || "Signup failed" });
  }
});

// ========================================
// SENSOR DATA (HTTP fallback — optionnel)
// ========================================

app.post("/sensor-data", async (req, res) => {
  try {
    const payload =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : { payload: req.body };

    const structured = transformESP32Payload(payload);
    await saveSensorReading(structured);

    res.json({ ok: true, receivedAt: structured.receivedAt, deviceId: structured.deviceId });
  } catch (err) {
    console.error("sensor-data error:", err);
    res.status(500).json({ error: err.message || "Failed to save sensor data" });
  }
});

app.get("/sensor-data/latest", requireAuth, async (req, res) => {
  try {
    const deviceId = req.query.deviceId || "ESP32_001";
    const snap = await rtdb.ref(`sensors/${deviceId}/current`).get();
    res.json(snap.exists() ? snap.val() : null);
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch latest data" });
  }
});

app.get("/sensor-data/history", requireAuth, async (req, res) => {
  try {
    const deviceId = req.query.deviceId || "ESP32_001";
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 168);
    const cutoffDate = new Date(Date.now() - hours * 3600 * 1000);

    const snapshot = await db
      .collection("sensorHistory")
      .where("deviceId", "==", deviceId)
      .where("timestamp", ">=", cutoffDate)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    const readings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ readings });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch history" });
  }
});

// ========================================
// ALERTS
// ========================================

app.get("/alerts", requireAuth, async (_req, res) => {
  try {
    const snapshot = await db.collection("alerts").orderBy("timestamp", "desc").limit(200).get();
    const alerts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to fetch alerts" });
  }
});

app.post("/alerts", requireAuth, async (req, res) => {
  try {
    const { type, severity, message, sensorData } = req.body || {};
    if (!type || !severity || !message) {
      return res.status(400).json({ error: "type, severity and message required" });
    }
    const ref = await db.collection("alerts").add({
      type, severity, message, sensorData: sensorData || null,
      resolved: false, createdBy: req.user.uid, timestamp: new Date(),
    });
    const saved = await ref.get();
    res.json({ alert: { id: saved.id, ...saved.data() } });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to create alert" });
  }
});

app.put("/alerts/:alertId/resolve", requireAuth, async (req, res) => {
  try {
    const ref = db.collection("alerts").doc(req.params.alertId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Alert not found" });
    await ref.set({ resolved: true, resolvedAt: new Date(), resolvedBy: req.user.uid }, { merge: true });
    const updated = await ref.get();
    res.json({ alert: { id: updated.id, ...updated.data() } });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to resolve alert" });
  }
});

// ========================================
// STATS
// ========================================

app.get("/stats", requireAuth, async (_req, res) => {
  try {
    const [latestSnap, alertsSnap, readingsSnap] = await Promise.all([
      db.collection("sensorHistory").orderBy("timestamp", "desc").limit(1).get(),
      db.collection("alerts").where("resolved", "==", false).get(),
      db.collection("sensorHistory").count().get(),
    ]);
    const latest = latestSnap.empty ? null : latestSnap.docs[0].data();
    res.json({
      latest,
      totalReadings: readingsSnap.data().count || 0,
      alertsOpen: alertsSnap.size,
      alertsTotal: null,
      lastUpdated: latest?.receivedAt || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to compute stats" });
  }
});

// ========================================
// ADMIN — USERS
// ========================================

app.get("/admin/users", requireAdmin, async (_req, res) => {
  try {
    const list = await admin.auth().listUsers(1000);
    const users = await Promise.all(
      list.users.map(async (u) => {
        const doc = await db.collection("users").doc(u.uid).get();
        return {
          id: u.uid, email: u.email || null,
          name: u.displayName || doc.data()?.displayName || null,
          role: u.customClaims?.role || doc.data()?.role || "user",
          created_at: u.metadata.creationTime || null,
        };
      })
    );
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to list users" });
  }
});

app.delete("/admin/users/:userId", requireAdmin, async (req, res) => {
  try {
    await admin.auth().deleteUser(req.params.userId);
    await db.collection("users").doc(req.params.userId).delete().catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to delete user" });
  }
});

// ========================================
// ADMIN — CONFIG
// ========================================

app.get("/admin/config", requireAdmin, async (_req, res) => {
  try {
    const doc = await db.collection("config").doc("system").get();
    res.json(doc.exists ? doc.data() : {});
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to load config" });
  }
});

app.put("/admin/config", requireAdmin, async (req, res) => {
  try {
    const updates = req.body && typeof req.body === "object" ? req.body : {};
    const ref = db.collection("config").doc("system");
    await ref.set({ ...updates, updatedAt: new Date(), updatedBy: req.user.uid }, { merge: true });
    const snap = await ref.get();
    res.json(snap.data());
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to update config" });
  }
});

// ========================================
// EXPORT
// ========================================

exports.api = onRequest(
  { region: "europe-west1", cors: true, maxInstances: 10 },
  app
);