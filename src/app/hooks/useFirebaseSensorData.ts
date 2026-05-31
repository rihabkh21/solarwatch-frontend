import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { realtimeDb } from '../config/firebase';
import { generatePanelRealtimeData, mockPanels, type SensorData, type SolarPanel } from '../data/mockData';

// ── Helper — mappe les deux formats ESP32 ─────────────────────────────────────

// Normalise les donnees Firebase en un objet SensorData uniforme,
// compatible avec l'ancien et le nouveau format d'envoi de l'ESP32
function mapFirebaseData(data: any, fallback: SensorData): SensorData {
  return {
    // Utilise receivedAt si disponible, sinon l'heure actuelle
    timestamp: data.receivedAt || new Date().toISOString(),

    // Nouveau format : data.voltage.value — Ancien : data.voltageDivider.voltage
    voltageDivider: {
      voltage:    data.voltage?.value        ?? data.voltageDivider?.voltage    ?? fallback.voltageDivider.voltage,
      voltageRaw: data.voltage?.raw          ?? data.voltageRaw                 ?? data.voltageDivider?.voltageRaw ?? 0,
      r1:         data.voltageDivider?.r1    ?? '30kΩ',
      r2:         data.voltageDivider?.r2    ?? '10kΩ',
    },

    // Nouveau format : data.acs712.current (mA) — Ancien : data.currentShunt.current
    // ESP32 envoie directement : data.current (mA)
    acs712: {
      current:     data.current              ?? data.acs712?.current            ?? data.currentShunt?.current     ?? fallback.acs712.current,
      voltage:     data.acs712?.rawVoltage   ?? 2500,
      sensitivity: data.acs712?.sensitivity  ?? 185,
      model:       data.acs712?.model        ?? 'ACS712-5A',
    },

    // DS18B20 — ESP32 envoie { temperature: 55.7, ds18b20Address: "28:FF:..." }
    ds18b20: {
      temperature: data.temperature          ?? data.ds18b20?.temperature       ?? fallback.ds18b20.temperature,
      address:     data.ds18b20Address       ?? data.ds18b20?.address           ?? '',
    },

    // BH1750 — ESP32 envoie { lux: 94000, lightLevel: "bright" }
    bh1750: {
      lux:        data.lux                   ?? data.bh1750?.lux                ?? fallback.bh1750.lux,
      lightLevel: data.lightLevel            ?? data.bh1750?.lightLevel         ?? 'normal',
      mode:       data.bh1750?.mode          ?? 'Continuous High Res Mode',
    },

    // ESP32 envoie { wifiRSSI, uptime, freeHeap }
    esp32: {
      model:      data.system?.model         ?? data.esp32?.model               ?? 'ESP32-WROOM-32U',
      wifiSignal: data.wifiRSSI              ?? data.system?.wifiRSSI           ?? data.esp32?.wifiSignal         ?? fallback.esp32.wifiSignal,
      uptime:     data.uptime                ?? data.system?.uptime             ?? data.esp32?.uptime             ?? 0,
      freeHeap:   data.freeHeap              ?? data.system?.freeHeap           ?? data.esp32?.freeHeap           ?? 0,
      voltage:    data.esp32?.voltage        ?? 5.1,
    },

    // ESP32 envoie { power, energy (Wh), efficiency }
    // energy est converti de Wh en mWh pour coherence interne
    calculated: {
      power:      data.power                 ?? data.calculated?.power          ?? fallback.calculated.power,
      energy24h:  data.energy != null ? data.energy * 1000 : (data.calculated?.energy24h ?? fallback.calculated.energy24h),
      efficiency: data.efficiency            ?? data.calculated?.efficiency     ?? fallback.calculated.efficiency,
    },
  };
}

// ── Hook principal — écoute ESP32_001 ─────────────────────────────────────────

// Ecoute en temps reel les donnees du capteur principal ESP32_001 dans Firebase Realtime Database
// Bascule automatiquement sur les donnees simulees si aucune donnee Firebase n'est disponible
export function useSensorData(updateInterval: number = 3000) {
  // Donnees de secours generees localement si Firebase ne repond pas
  const fallback = generatePanelRealtimeData(mockPanels[0]);
  const [sensorData, setSensorData] = useState<SensorData>(() => fallback);
  // isLive indique si les donnees proviennent de l'ESP32 reel (true) ou de la simulation (false)
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    // Reference au noeud Firebase contenant les dernieres donnees de l'ESP32_001
    const dbRef = ref(realtimeDb, 'sensors/ESP32_001/current');

    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        // Donnees reelles disponibles : on les normalise et on active le mode live
        setSensorData(mapFirebaseData(snapshot.val(), fallback));
        setIsLive(true);
      } else {
        // Pas de donnees Firebase : on utilise les donnees simulees
        setSensorData(generatePanelRealtimeData(mockPanels[0]));
        setIsLive(false);
      }
    });

    // Desinscription de l'ecouteur Firebase au demontage du composant
    return () => off(dbRef);
  }, []);

  return { sensorData, isLive, refreshData: () => {} };
}

// ── Par panneau spécifique ────────────────────────────────────────────────────

// Ecoute les donnees Firebase d'un panneau specifique identifie par son ID (ex: P1 -> ESP32_001)
// Si aucune donnee n'est disponible, genere des donnees mock animees pour ce panneau
export function usePanelData(panel: SolarPanel, updateInterval: number = 2000) {
  const fallback = generatePanelRealtimeData(panel);
  const [sensorData, setSensorData] = useState<SensorData>(() => fallback);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    // FIX : panel.id est un string ('P1', 'P2'...), pas un number
    // Extrait le numero du panneau pour construire l'identifiant Firebase (ex: P2 -> ESP32_002)
    const panelNumber = panel.id.replace('P', '');
    const deviceId    = `ESP32_00${panelNumber}`;
    const dbRef       = ref(realtimeDb, `sensors/${deviceId}/current`);

    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        setSensorData(mapFirebaseData(snapshot.val(), fallback));
        setIsLive(true);
      } else {
        // Fallback mock animé pour panneaux sans ESP32
        setSensorData(generatePanelRealtimeData(panel));
        setIsLive(false);
        // Simule une mise a jour periodique tant qu'aucun ESP32 n'est connecte
        const interval = setInterval(
          () => setSensorData(generatePanelRealtimeData(panel)),
          updateInterval
        );
        return () => clearInterval(interval);
      }
    });

    // Desinscription de l'ecouteur au changement de panneau ou d'intervalle
    return () => off(dbRef);
  }, [panel.id, updateInterval]);

  return { sensorData, isLive };
}