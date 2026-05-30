import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyD5kDTdN3ZwiKV-lS3f6dHcJs-xOpD3nu8",
  authDomain: "solarwatch-8c68a.firebaseapp.com",
  databaseURL: "https://solarwatch-8c68a-default-rtdb.firebaseio.com",
  projectId: "solarwatch-8c68a",
  storageBucket: "solarwatch-8c68a.firebasestorage.app",
  messagingSenderId: "950107235339",
  appId: "1:950107235339:web:7d983db9c6c438bb91930e"
};

const app  = initializeApp(firebaseConfig);
const rtdb = getDatabase(app);

// ── Simulation capteurs réels ─────────────────────────────────────────────────

function getHour() {
  return new Date().getHours();
}

function getSunIntensity() {
  const hour    = getHour();
  const sunrise = 6;
  const sunset  = 19;
  if (hour < sunrise || hour > sunset) return 0;
  return Math.max(0, Math.sin((hour - sunrise) * Math.PI / (sunset - sunrise)));
}

function generateSensorData() {
  const sun     = getSunIntensity();
  const noise   = () => (Math.random() - 0.5) * 0.05; // bruit ±5%

  // DS18B20 — température panneau
  const ambientTemp   = 22 + sun * 15;
  const panelTemp     = ambientTemp + sun * 20 + (Math.random() - 0.5) * 2;

  // BH1750 — luminosité
  const lux           = Math.max(0, sun * 95000 + (Math.random() - 0.5) * 8000);
  const lightLevel    = lux < 10 ? 'dark' : lux < 1000 ? 'dim' : lux < 50000 ? 'normal' : 'bright';

  // Pont diviseur — tension panneau
  const voltage       = sun > 0 ? 6 + sun * 5 + noise() * 2 : 0.1 + Math.random() * 0.2;
  const voltageRaw    = Math.floor((voltage / 4) / 3.3 * 4095);

  // ACS712 — courant (remplace currentShunt)
  const currentA      = sun > 0 ? sun * 0.9 + noise() * 0.1 : 0;
  const currentMa     = currentA * 1000;
  // ACS712 : Vout = 2500mV + (185mV/A * I)
  const acs712Voltage = 2500 + (185 * currentA);

  // Puissance calculée
  const power         = voltage * currentA;
  const energy24h     = power * sun * 12; // estimation
  const efficiency    = sun > 0 ? (70 + sun * 25 + (Math.random() - 0.5) * 5) : 0;

  return {
    deviceId:        'ESP32_001',
    receivedAt:      new Date().toISOString(),
    serverTimestamp: Date.now(),

    // DS18B20
    ds18b20: {
      temperature: parseFloat(panelTemp.toFixed(1)),
      address:     '28:FF:64:0C:80:16:03:5C',
    },

    // BH1750
    bh1750: {
      lux:        parseFloat(lux.toFixed(0)),
      lightLevel,
      mode:       'Continuous High Res Mode',
    },

    // Pont diviseur tension
    voltageDivider: {
      voltage:    parseFloat(voltage.toFixed(2)),
      voltageRaw: voltageRaw,
      r1:         '30kΩ',
      r2:         '10kΩ',
    },

    // ACS712 courant (remplace currentShunt)
    acs712: {
      current:     parseFloat(currentMa.toFixed(1)),  // mA
      voltage:     parseFloat(acs712Voltage.toFixed(1)), // mV sortie ACS712
      sensitivity: 185,
      model:       'ACS712-05B',
    },

    // Valeurs calculées
    calculated: {
      power:      parseFloat(power.toFixed(2)),
      energy24h:  parseFloat(energy24h.toFixed(1)),
      efficiency: parseFloat(efficiency.toFixed(1)),
    },

    // ESP32
    esp32: {
      model:      'ESP32-WROOM-32U',
      wifiSignal: -45 - Math.floor(Math.random() * 20),
      uptime:     Math.floor(Date.now() / 1000) % 86400,
      freeHeap:   180000 + Math.floor(Math.random() * 50000),
      voltage:    parseFloat((5.1 + (Math.random() - 0.5) * 0.1).toFixed(2)),
    },
  };
}

// ── Envoi vers Firebase toutes les 5 secondes ─────────────────────────────────

async function sendData() {
  const data    = generateSensorData();
  const hour    = getHour();
  const sun     = getSunIntensity();

  try {
    await set(ref(rtdb, 'sensors/ESP32_001/current'), data);
    console.log(
      `[${new Date().toLocaleTimeString('fr-TN')}] ` +
      ` ${data.ds18b20.temperature}°C | ` +
      ` ${data.bh1750.lux} lux | ` +
      ` ${data.voltageDivider.voltage}V | ` +
      ` ${data.acs712.current.toFixed(0)}mA | ` +
      ` ${data.calculated.power}W`
    );
  } catch (err) {
    console.error('Erreur Firebase:', err.message);
  }
}

// ── Démarrage ─────────────────────────────────────────────────────────────────

console.log('Simulateur capteurs SolarWatch démarré');
console.log('   Capteurs : DS18B20 · BH1750 · ACS712 · Pont diviseur');
console.log('   Mise à jour toutes les 5 secondes — Ctrl+C pour arrêter\n');

sendData(); // Premier envoi immédiat
setInterval(sendData, 5000); // Puis toutes les 5 secondes
