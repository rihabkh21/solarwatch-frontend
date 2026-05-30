import { useState, useEffect, useRef } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { realtimeDb } from '../config/firebase';
import { generatePanelRealtimeData, mockPanels, type SensorData, type SolarPanel } from '../data/mockData';

// ── Config HiveMQ Cloud ───────────────────────────────────────────────────────
const HIVEMQ_HOST     = '4a24dfd2e8ba429ea6be9824c0611d27.s1.eu.hivemq.cloud';
const HIVEMQ_USER     = 'solarwatch';
const HIVEMQ_PASSWORD = 'SolarWatch2026!';
const HIVEMQ_WS_URL   = `wss://${HIVEMQ_HOST}:8884/mqtt`;

// ── Estime la tension depuis la luminosité (identique à index.js) ─────────────
function estimateVoltage(lux: number, measuredVoltage: number): number {
  if (measuredVoltage > 0) return measuredVoltage;
  const estimated = 6.0 + (lux / 100000.0) * 6.0;
  return parseFloat(estimated.toFixed(2));
}

// ── Filtre le courant (bruit ACS712 la nuit) ──────────────────────────────────
function filterCurrent(currentMa: number, lux: number): number {
  if (lux < 50) return 0;
  return currentMa;
}

// ── Mappe le format plat ESP32 → SensorData ───────────────────────────────────
function mapESP32Data(data: any, fallback: SensorData): SensorData {
  const lux        = data.lux ?? data.bh1750?.lux ?? fallback.bh1750.lux;
  const rawVoltage = data.voltage ?? data.voltageDivider?.voltage ?? 0;
  const voltage    = estimateVoltage(lux, rawVoltage);
  const rawCurrent = data.current ?? data.acs712?.current ?? fallback.acs712.current;
  const currentMa  = filterCurrent(rawCurrent, lux);
  const powerCalc  = voltage > 0 && currentMa > 0
    ? parseFloat(((voltage * currentMa) / 1000).toFixed(2))
    : 0;

  return {
    timestamp: data.receivedAt ?? data.timestamp ?? new Date().toISOString(),
    ds18b20: {
      temperature: data.temperature    ?? data.ds18b20?.temperature    ?? fallback.ds18b20.temperature,
      address:     data.ds18b20Address ?? data.ds18b20?.address        ?? '',
    },
    bh1750: {
      lux,
      lightLevel: (data.lightLevel ?? data.bh1750?.lightLevel ?? 'normal') as SensorData['bh1750']['lightLevel'],
      mode:       data.bh1750?.mode ?? 'Continuous High Res Mode',
    },
    voltageDivider: {
      voltage,
      voltageRaw: data.voltageRaw ?? data.voltageDivider?.voltageRaw ?? 0,
      r1:         data.voltageDivider?.r1 ?? '30kΩ',
      r2:         data.voltageDivider?.r2 ?? '10kΩ',
    },
    acs712: {
      current:     currentMa,
      voltage:     data.acs712?.rawVoltage ?? 2500,
      sensitivity: data.acs712?.sensitivity ?? 185,
      model:       data.acs712?.model ?? 'ACS712-5A',
    },
    esp32: {
      model:      'ESP32-WROOM-32U',
      wifiSignal: data.wifiRSSI       ?? data.esp32?.wifiSignal ?? fallback.esp32.wifiSignal,
      uptime:     data.uptime         ?? data.esp32?.uptime     ?? 0,
      freeHeap:   data.freeHeap       ?? data.esp32?.freeHeap   ?? 0,
      voltage:    data.esp32?.voltage ?? 5.0,
    },
    calculated: {
      power: data.power > 0
        ? data.power
        : (data.calculated?.power ?? powerCalc),

      //  Fix — lire energy24h directement depuis Firebase (champ plat en Wh)
      //  data.energy24h (existe dans RTDB, ex: 5.08 Wh) → correct
      energy24h: data.energy24h
        ?? data.calculated?.energy24h
        ?? fallback.calculated.energy24h,

      efficiency: data.efficiency
        ?? data.calculated?.efficiency
        ?? fallback.calculated.efficiency,
    },
  };
}

// ── Builders paquets MQTT binaires ────────────────────────────────────────────
function buildMQTTConnect(clientId: string, user: string, pass: string): ArrayBuffer {
  const enc      = new TextEncoder();
  const cidBytes = enc.encode(clientId);
  const uBytes   = enc.encode(user);
  const pBytes   = enc.encode(pass);
  const connectFlags = 0b11000010;
  const variableHeader = new Uint8Array([
    0, 4, 0x4D, 0x51, 0x54, 0x54,
    4,
    connectFlags,
    0, 60,
  ]);
  const payload = new Uint8Array([
    0, cidBytes.length, ...cidBytes,
    0, uBytes.length,   ...uBytes,
    0, pBytes.length,   ...pBytes,
  ]);
  const remaining = variableHeader.length + payload.length;
  return new Uint8Array([0x10, remaining, ...variableHeader, ...payload]).buffer;
}

function buildMQTTSubscribe(topic: string): ArrayBuffer {
  const t = new TextEncoder().encode(topic);
  const payload = new Uint8Array([0, 1, 0, t.length, ...t, 0]);
  return new Uint8Array([0x82, payload.length, ...payload]).buffer;
}

function buildMQTTPingReq(): ArrayBuffer {
  return new Uint8Array([0xC0, 0x00]).buffer;
}

function parseMQTTPublish(buf: Uint8Array): string | null {
  try {
    let pos = 1;
    let mul = 1, len = 0;
    do { len += (buf[pos] & 127) * mul; mul *= 128; } while (buf[pos++] & 128);
    const topicLen = (buf[pos] << 8) | buf[pos + 1];
    pos += 2 + topicLen;
    return new TextDecoder().decode(buf.slice(pos, 1 + len + (1 + topicLen + 2)));
  } catch {
    return null;
  }
}

// ── Hook WebSocket MQTT → HiveMQ Cloud ───────────────────────────────────────
function useMQTTSensor(topic: string, fallbackRef: React.MutableRefObject<SensorData>) {
  const [sensorData, setSensorData] = useState<SensorData>(() => fallbackRef.current);
  const [isLive, setIsLive]         = useState(false);
  const wsRef        = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;

    function connect() {
      if (!active) return;

      const ws = new WebSocket(HIVEMQ_WS_URL, ['mqtt']);
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';
      let connected = false;

      ws.onopen = () => {
        const clientId = `sw-frontend-${Math.random().toString(36).slice(2, 9)}`;
        ws.send(buildMQTTConnect(clientId, HIVEMQ_USER, HIVEMQ_PASSWORD));
      };

      ws.onmessage = (event) => {
        try {
          const buf  = new Uint8Array(event.data as ArrayBuffer);
          const type = (buf[0] >> 4) & 0xf;

          if (type === 2 && !connected) {
            const returnCode = buf[3];
            if (returnCode !== 0) {
              console.error(`❌ HiveMQ CONNACK error: ${returnCode}`);
              ws.close();
              return;
            }
            connected = true;
            ws.send(buildMQTTSubscribe(topic));
            pingRef.current = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) ws.send(buildMQTTPingReq());
            }, 30000);
          } else if (type === 3) {
            const payload = parseMQTTPublish(buf);
            if (payload && active) {
              const raw = JSON.parse(payload);
              setSensorData(mapESP32Data(raw, fallbackRef.current));
              setIsLive(true);
            }
          }
        } catch (_) {}
      };

      ws.onerror = () => ws.close();

      ws.onclose = () => {
        if (pingRef.current) clearInterval(pingRef.current);
        if (active) {
          setIsLive(false);
          reconnectRef.current = setTimeout(connect, 5000);
        }
      };
    }

    connect();

    return () => {
      active = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (pingRef.current)      clearInterval(pingRef.current);
      wsRef.current?.close();
    };
  }, [topic]);

  return { sensorData, isLive };
}

// ── Hook principal (ESP32_001) ────────────────────────────────────────────────
export function useSensorData(_updateInterval: number = 3000) {
  const fallbackRef = useRef<SensorData>(generatePanelRealtimeData(mockPanels[0]));

  const [firebaseData, setFirebaseData] = useState<SensorData | null>(null);
  const [firebaseLive, setFirebaseLive] = useState(false);

  useEffect(() => {
    const dbRef = ref(realtimeDb, 'sensors/ESP32_001/current');
    onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const raw = snapshot.val();
        const hasRealData = (raw.temperature > 0) || (raw.lux > 0);
        if (hasRealData) {
          setFirebaseData(mapESP32Data(raw, fallbackRef.current));
          setFirebaseLive(true);
        }
      } else {
        setFirebaseLive(false);
      }
    });
    return () => off(dbRef);
  }, []);

  const { sensorData: mqttData, isLive: mqttLive } = useMQTTSensor(
    'solarwatch/ESP32_001/data',
    fallbackRef
  );

  //  Fusion MQTT (capteurs live) + Firebase (champs calculés: efficiency, energy24h)
  const sensorData: SensorData = mqttLive && firebaseLive && firebaseData
    ? {
        ...mqttData,
        calculated: {
          power: mqttData.calculated.power > 0
            ? mqttData.calculated.power
            : firebaseData.calculated.power,
          energy24h:  firebaseData.calculated.energy24h,  // Firebase uniquement (Wh réels)
          efficiency: firebaseData.calculated.efficiency, //  Firebase uniquement
        },
      }
    : mqttLive
      ? mqttData
      : (firebaseLive && firebaseData ? firebaseData : fallbackRef.current);

  const isLive = mqttLive || firebaseLive;

  return { sensorData, isLive, refreshData: () => {} };
}

// ── Par panneau spécifique ────────────────────────────────────────────────────
export function usePanelData(panel: SolarPanel, _updateInterval: number = 2000) {
  const fallbackRef = useRef<SensorData>(generatePanelRealtimeData(panel));

  const panelNumber = panel.id.replace('P', '');
  const deviceId    = `ESP32_00${panelNumber}`;
  const mqttTopic   = `solarwatch/${deviceId}/data`;

  const [firebaseData, setFirebaseData] = useState<SensorData | null>(null);
  const [firebaseLive, setFirebaseLive] = useState(false);

  useEffect(() => {
    const dbRef = ref(realtimeDb, `sensors/${deviceId}/current`);
    onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const raw = snapshot.val();
        const hasRealData = (raw.temperature > 0) || (raw.lux > 0);
        if (hasRealData) {
          setFirebaseData(mapESP32Data(raw, fallbackRef.current));
          setFirebaseLive(true);
        }
      } else {
        setFirebaseLive(false);
      }
    });
    return () => off(dbRef);
  }, [deviceId]);

  const { sensorData: mqttData, isLive: mqttLive } = useMQTTSensor(mqttTopic, fallbackRef);

  //  Fusion MQTT (capteurs live) + Firebase (champs calculés: efficiency, energy24h)
  const sensorData: SensorData = mqttLive && firebaseLive && firebaseData
    ? {
        ...mqttData,
        calculated: {
          power: mqttData.calculated.power > 0
            ? mqttData.calculated.power
            : firebaseData.calculated.power,
          energy24h:  firebaseData.calculated.energy24h,  //  Firebase uniquement
          efficiency: firebaseData.calculated.efficiency, //  Firebase uniquement
        },
      }
    : mqttLive
      ? mqttData
      : (firebaseLive && firebaseData ? firebaseData : fallbackRef.current);

  const isLive = mqttLive || firebaseLive;

  return { sensorData, isLive };
}