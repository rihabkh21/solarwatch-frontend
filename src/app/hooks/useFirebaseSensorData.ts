import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { realtimeDb } from '../config/firebase';
import { generatePanelRealtimeData, mockPanels, type SensorData, type SolarPanel } from '../data/mockData';

// ── Helper — mappe les deux formats ESP32 ─────────────────────────────────────
function mapFirebaseData(data: any, fallback: SensorData): SensorData {
  return {
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
    calculated: {
      power:      data.power                 ?? data.calculated?.power          ?? fallback.calculated.power,
      energy24h:  data.energy != null ? data.energy * 1000 : (data.calculated?.energy24h ?? fallback.calculated.energy24h),
      efficiency: data.efficiency            ?? data.calculated?.efficiency     ?? fallback.calculated.efficiency,
    },
  };
}

// ── Hook principal — écoute ESP32_001 ─────────────────────────────────────────
export function useSensorData(updateInterval: number = 3000) {
  const fallback = generatePanelRealtimeData(mockPanels[0]);
  const [sensorData, setSensorData] = useState<SensorData>(() => fallback);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const dbRef = ref(realtimeDb, 'sensors/ESP32_001/current');

    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        setSensorData(mapFirebaseData(snapshot.val(), fallback));
        setIsLive(true);
      } else {
        setSensorData(generatePanelRealtimeData(mockPanels[0]));
        setIsLive(false);
      }
    });

    return () => off(dbRef);
  }, []);

  return { sensorData, isLive, refreshData: () => {} };
}

// ── Par panneau spécifique ────────────────────────────────────────────────────
export function usePanelData(panel: SolarPanel, updateInterval: number = 2000) {
  const fallback = generatePanelRealtimeData(panel);
  const [sensorData, setSensorData] = useState<SensorData>(() => fallback);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    // FIX : panel.id est un string ('P1', 'P2'...), pas un number
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
        const interval = setInterval(
          () => setSensorData(generatePanelRealtimeData(panel)),
          updateInterval
        );
        return () => clearInterval(interval);
      }
    });

    return () => off(dbRef);
  }, [panel.id, updateInterval]);

  return { sensorData, isLive };
}