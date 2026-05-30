import { initializeApp } from 'firebase/app';
import { getFirestore, setDoc, doc } from 'firebase/firestore';
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

const app = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const rtdb = getDatabase(app);

// ── Panels ───────────────────────────────────────────────────────────────────
const panels = [
  {
    id: 'P1', name: 'Panneau Toit Sud', location: 'Toit, exposition plein Sud',
    active: true, color: 'amber', efficiencyFactor: 1.0, tempOffset: 0,
    sensors: {
      ds18b20:        { address: '28:FF:64:0C:80:16:03:5C', gpioPin: 4 },
      bh1750:         { i2cAddress: '0x23', sdaPin: 21, sclPin: 22 },
      voltageDivider: { adcPin: 34, r1: '30kΩ', r2: '10kΩ' },
      acs712:         { adcPin: 35, sensitivity: 185, model: 'ACS712-05B' },
    },
    specs: { nominalVoltage: '6V', maxVoltage: '12V', estimatedPower: '10W', type: 'Mini panneau solaire' },
    installDate: '2024-03-15',
  },
  {
    id: 'P2', name: 'Panneau Toit Est', location: 'Toit, exposition Est',
    active: true, color: 'blue', efficiencyFactor: 0.88, tempOffset: -3,
    sensors: {
      ds18b20:        { address: '28:FF:A1:2B:91:17:04:7D', gpioPin: 4 },
      bh1750:         { i2cAddress: '0x5C', sdaPin: 21, sclPin: 22 },
      voltageDivider: { adcPin: 36, r1: '30kΩ', r2: '10kΩ' },
      acs712:         { adcPin: 39, sensitivity: 185, model: 'ACS712-05B' },
    },
    specs: { nominalVoltage: '6V', maxVoltage: '12V', estimatedPower: '10W', type: 'Mini panneau solaire' },
    installDate: '2024-03-15',
  },
  {
    id: 'P3', name: 'Panneau Jardin', location: 'Jardin, légère ombre partielle',
    active: true, color: 'green', efficiencyFactor: 0.74, tempOffset: -6,
    sensors: {
      ds18b20:        { address: '28:FF:C3:4E:A2:18:05:9E', gpioPin: 4 },
      bh1750:         { i2cAddress: 'Mux TCA9548A', channel: 0, sdaPin: 21, sclPin: 22 },
      voltageDivider: { adcPin: 32, r1: '30kΩ', r2: '10kΩ' },
      acs712:         { adcPin: 33, sensitivity: 185, model: 'ACS712-05B' },
    },
    specs: { nominalVoltage: '6V', maxVoltage: '12V', estimatedPower: '10W', type: 'Mini panneau solaire' },
    installDate: '2024-05-20',
  },
];

// ── Users ────────────────────────────────────────────────────────────────────
const users = [
  { uid: 'admin', email: 'admin@solarwatch.tn', displayName: 'Ahmed Ben Ali', role: 'admin' },
  { uid: 'tech',  email: 'tech@solarwatch.tn',  displayName: 'Mehdi Gharbi',  role: 'technicien' },
  { uid: 'user',  email: 'user@solarwatch.tn',  displayName: 'Sara Mansour',  role: 'user' },
];

// ── Seed ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('🌱 Seeding Firestore...');

  // Panels — avec ACS712
  for (const panel of panels) {
    await setDoc(doc(db, 'panels', panel.id), panel);
    console.log(`✅ Panel ${panel.id} mis à jour (ACS712)`);
  }

  // Users
  for (const user of users) {
    await setDoc(doc(db, 'users', user.uid), user);
    console.log(`✅ User ${user.email} créé`);
  }

  // Settings
  await setDoc(doc(db, 'settings', 'system'), {
    maxTemperature: 75,
    minVoltage: 5,
    alertsEnabled: true,
    updateInterval: 30,
  });
  console.log('✅ Settings créés');

  // Realtime DB — données capteurs avec ACS712
  await set(ref(rtdb, 'sensors/ESP32_001/current'), {
    deviceId:        'ESP32_001',
    serverTimestamp: Date.now(),
    receivedAt:      new Date().toISOString(),
    voltageDivider:  { voltage: 10.8, voltageRaw: 3350, r1: '30kΩ', r2: '10kΩ' },
    acs712:          { current: 910, voltage: 2668, sensitivity: 185, model: 'ACS712-05B' },
    ds18b20:         { temperature: 55.4, address: '28:FF:64:0C:80:16:03:5C' },
    bh1750:          { lux: 96800, lightLevel: 'bright', mode: 'Continuous High Res Mode' },
    esp32:           { model: 'ESP32-WROOM-32U', wifiSignal: -52, uptime: 3600, freeHeap: 210000, voltage: 5.1 },
    calculated:      { power: 8.5, energy24h: 95, efficiency: 82 },
  });
  console.log('✅ Realtime DB mise à jour (ACS712)');

  console.log('🎉 Seed terminé !');
  process.exit(0);
}

seed().catch(console.error);
