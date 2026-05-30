import { getApproximateSunrise, getApproximateSunset } from '../utils/dateTime';

// ─── Solar Panel Config ───────────────────────────────────────────────────────

export interface SolarPanel {
  id: string;
  name: string;
  location: string;
  active: boolean;
  color: 'amber' | 'blue' | 'green' | 'purple' | 'rose';
  efficiencyFactor: number;
  tempOffset: number;
  sensors: {
    ds18b20: {
      address: string;
      gpioPin: number;
    };
    bh1750: {
      i2cAddress: string;
      channel?: number;
      sdaPin: number;
      sclPin: number;
    };
    voltageDivider: {
      adcPin: number;
      r1: string;
      r2: string;
    };
    acs712: {
      adcPin: number;
      sensitivity: number;
      model: string;
    };
  };
  specs: {
    nominalVoltage: string;
    maxVoltage: string;
    estimatedPower: string;
    type: string;
  };
  installDate: string;
}

export const mockPanels: SolarPanel[] = [
  {
    id: 'P1',
    name: 'panneau1',
    location: 'kairouan',
    active: true,
    color: 'amber',
    efficiencyFactor: 1.0,
    tempOffset: 0,
    sensors: {
      ds18b20:        { address: 'ID1', gpioPin: 4 },
      bh1750:         { i2cAddress: '0x23', sdaPin: 21, sclPin: 22 },
      voltageDivider: { adcPin: 34, r1: '30kΩ', r2: '10kΩ' },
      acs712:         { adcPin: 34, sensitivity: 185, model: 'ACS712-05B' },
    },
    specs: { nominalVoltage: '6V', maxVoltage: '12V', estimatedPower: '10W', type: 'Mini panneau solaire' },
    installDate: '2024-03-15',
  },
  {
    id: 'P2',
    name: 'Panneau Toit Est',
    location: 'Toit, exposition Est',
    active: true,
    color: 'blue',
    efficiencyFactor: 0.88,
    tempOffset: -3,
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
    id: 'P3',
    name: 'Panneau Jardin',
    location: 'Jardin, légère ombre partielle',
    active: true,
    color: 'green',
    efficiencyFactor: 0.74,
    tempOffset: -6,
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

// ─── SensorData ───────────────────────────────────────────────────────────────

export interface SensorData {
  timestamp: string;
  voltageDivider: {
    voltage: number;
    voltageRaw: number;
    r1: string;
    r2: string;
  };
  acs712: {
    current: number;
    voltage: number;
    sensitivity: number;
    model: string;
  };
  ds18b20: {
    temperature: number;
    address: string;
  };
  bh1750: {
    lux: number;
    lightLevel: 'dark' | 'dim' | 'normal' | 'bright';
    mode: string;
  };
  esp32: {
    model: string;
    wifiSignal: number;
    uptime: number;
    freeHeap: number;
    voltage: number;
  };
  calculated: {
    power: number;
    energy24h: number;
    efficiency: number;
  };
}

// ─── Génération données temps réel ────────────────────────────────────────────

export function generatePanelRealtimeData(panel: SolarPanel): SensorData {
  const now = new Date();
  const hour = now.getHours();
  const sunrise = getApproximateSunrise(now);
  const sunset  = getApproximateSunset(now);
  const isDay   = hour >= sunrise && hour <= sunset;
  const baseSun = isDay ? Math.max(0, Math.sin((hour - sunrise) * Math.PI / (sunset - sunrise))) : 0;
  const sunIntensity = baseSun * panel.efficiencyFactor;

  const panelVoltage  = 6 + (sunIntensity * 6);
  const panelCurrent  = sunIntensity * 1000;
  const power         = (panelVoltage * panelCurrent) / 1000;
  const adcRaw        = Math.floor((panelVoltage / 4) / 3.3 * 4095);
  const lux           = Math.max(0, baseSun * 120000 * panel.efficiencyFactor + (Math.random() - 0.5) * 5000);
  const ambientTemp   = 22 + (baseSun * 18);
  const panelTemp     = ambientTemp + (sunIntensity * 25) + panel.tempOffset;
  const acs712Voltage = 2500 + (panel.sensors.acs712.sensitivity * (panelCurrent / 1000));

  const getLightLevel = (luxValue: number): 'dark' | 'dim' | 'normal' | 'bright' => {
    if (luxValue < 10)    return 'dark';
    if (luxValue < 1000)  return 'dim';
    if (luxValue < 50000) return 'normal';
    return 'bright';
  };

  return {
    timestamp: now.toISOString(),
    voltageDivider: {
      voltage:    panelVoltage + (Math.random() - 0.5) * 0.2,
      voltageRaw: adcRaw + Math.floor((Math.random() - 0.5) * 20),
      r1: panel.sensors.voltageDivider.r1,
      r2: panel.sensors.voltageDivider.r2,
    },
    acs712: {
      current:     panelCurrent + (Math.random() - 0.5) * 50,
      voltage:     acs712Voltage + (Math.random() - 0.5) * 10,
      sensitivity: panel.sensors.acs712.sensitivity,
      model:       panel.sensors.acs712.model,
    },
    ds18b20: {
      temperature: panelTemp + (Math.random() - 0.5) * 2,
      address:     panel.sensors.ds18b20.address,
    },
    bh1750: {
      lux,
      lightLevel: getLightLevel(lux),
      mode: 'Continuous High Res Mode',
    },
    esp32: {
      model:      'ESP32-WROOM-32U',
      wifiSignal: -45 - Math.random() * 30,
      uptime:     Math.floor(Date.now() / 1000) % 86400,
      freeHeap:   180000 + Math.random() * 50000,
      voltage:    5.1 + (Math.random() - 0.5) * 0.1,
    },
    calculated: {
      power,
      energy24h:  (45 + Math.random() * 10) * panel.efficiencyFactor,
      efficiency: (82 + Math.random() * 8) * panel.efficiencyFactor,
    },
  };
}

// ─── Génération historique ────────────────────────────────────────────────────

export function generateHistoricalData(hours: number = 24): SensorData[] {
  const data: SensorData[] = [];
  const now = new Date();

  for (let i = hours - 1; i >= 0; i--) {
    const timestamp    = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hour         = timestamp.getHours();
    const sunrise      = getApproximateSunrise(timestamp);
    const sunset       = getApproximateSunset(timestamp);
    const isDay        = hour >= sunrise && hour <= sunset;
    const sunIntensity = isDay ? Math.max(0, Math.sin((hour - sunrise) * Math.PI / (sunset - sunrise))) : 0;

    const panelVoltage  = 6 + (sunIntensity * 6);
    const panelCurrent  = sunIntensity * 1000;
    const power         = (panelVoltage * panelCurrent) / 1000;
    const lux           = sunIntensity * 120000 + (Math.random() - 0.5) * 5000;
    const ambientTemp   = 22 + (sunIntensity * 18);
    const panelTemp     = ambientTemp + (sunIntensity * 25);
    const adcRaw        = Math.floor((panelVoltage / 4) / 3.3 * 4095);
    const acs712Voltage = 2500 + (185 * (panelCurrent / 1000));

    const getLightLevel = (luxValue: number): 'dark' | 'dim' | 'normal' | 'bright' => {
      if (luxValue < 10)    return 'dark';
      if (luxValue < 1000)  return 'dim';
      if (luxValue < 50000) return 'normal';
      return 'bright';
    };

    data.push({
      timestamp: timestamp.toISOString(),
      voltageDivider: {
        voltage:    panelVoltage + (Math.random() - 0.5) * 0.2,
        voltageRaw: adcRaw + Math.floor((Math.random() - 0.5) * 20),
        r1: '30kΩ',
        r2: '10kΩ',
      },
      acs712: {
        current:     panelCurrent + (Math.random() - 0.5) * 50,
        voltage:     acs712Voltage,
        sensitivity: 185,
        model:       'ACS712-05B',
      },
      ds18b20: {
        temperature: panelTemp + (Math.random() - 0.5) * 2,
        address:     '28:FF:64:0C:80:16:03:5C',
      },
      bh1750: {
        lux:        Math.max(0, lux),
        lightLevel: getLightLevel(lux),
        mode:       'Continuous High Res Mode',
      },
      esp32: {
        model:      'ESP32-WROOM-32U',
        wifiSignal: -45 - Math.random() * 30,
        uptime:     Math.floor(timestamp.getTime() / 1000) % 86400,
        freeHeap:   180000 + Math.random() * 50000,
        voltage:    5.1 + (Math.random() - 0.5) * 0.1,
      },
      calculated: {
        power,
        energy24h:  45 + Math.random() * 10,
        efficiency: 82 + Math.random() * 8,
      },
    });
  }
  return data;
}

// ─── Alertes ──────────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  sensor: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

export const mockAlerts: Alert[] = [
  {
    id: '1',
    type: 'critical',
    sensor: 'Pont Diviseur',
    message: 'Chute de tension détectée : 4.2V (attendu: 6-12V)',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    resolved: false,
  },
  {
    id: '2',
    type: 'warning',
    sensor: 'DS18B20',
    message: 'Température du panneau élevée : 72°C',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    resolved: false,
  },
  {
    id: '3',
    type: 'info',
    sensor: 'BH1750',
    message: 'Luminosité optimale détectée : 98 500 lux',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    resolved: true,
  },
  {
    id: '4',
    type: 'warning',
    sensor: 'ACS712',
    message: 'Courant anormal détecté : 2.8A (attendu < 1.5A)',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    resolved: true,
  },
];

// ─── Interventions ────────────────────────────────────────────────────────────

export type InterventionStatus   = 'pending' | 'in_progress' | 'done';
export type InterventionPriority = 'critical' | 'warning' | 'info';

export interface InterventionMessage {
  id: string;
  from: string;
  fromName: string;
  fromRole: 'admin' | 'technicien';
  content: string;
  timestamp: string;
}

export interface Intervention {
  id: string;
  alertId?: string;
  title: string;
  description: string;
  priority: InterventionPriority;
  status: InterventionStatus;
  assignedTo: string;
  assignedToName: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  messages: InterventionMessage[];
}

export const mockInterventions: Intervention[] = [
  {
    id: 'int-1',
    alertId: '1',
    title: 'Vérification chute de tension — Pont Diviseur',
    description: 'Chute de tension critique à 4.2V détectée. Vérifier le câblage et les résistances.',
    priority: 'critical',
    status: 'in_progress',
    assignedTo: 'tech@solarwatch.tn',
    assignedToName: 'Mehdi Gharbi',
    createdBy: 'admin@solarwatch.tn',
    createdByName: 'Ahmed Ben Ali',
    createdAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    notes: 'Câblage inspecté, résistances OK. Problème au niveau du connecteur.',
    messages: [
      {
        id: 'msg-1',
        from: 'admin@solarwatch.tn',
        fromName: 'Ahmed Ben Ali',
        fromRole: 'admin',
        content: 'Mehdi, intervenir en urgence sur le panneau P1. Chute de tension critique.',
        timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-2',
        from: 'tech@solarwatch.tn',
        fromName: 'Mehdi Gharbi',
        fromRole: 'technicien',
        content: 'Je suis sur place. Connecteur endommagé détecté, remplacement en cours.',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'int-2',
    alertId: '4',
    title: 'Vérification courant ACS712 — Panneau P2',
    description: 'Courant anormal de 2.8A détecté par le capteur ACS712. Vérifier le circuit.',
    priority: 'warning',
    status: 'pending',
    assignedTo: 'tech@solarwatch.tn',
    assignedToName: 'Mehdi Gharbi',
    createdBy: 'admin@solarwatch.tn',
    createdByName: 'Ahmed Ben Ali',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    notes: '',
    messages: [
      {
        id: 'msg-3',
        from: 'admin@solarwatch.tn',
        fromName: 'Ahmed Ben Ali',
        fromRole: 'admin',
        content: 'Vérifier le capteur ACS712 sur P2, courant anormalement élevé.',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
];

// ─── Prédictions IA ───────────────────────────────────────────────────────────

export interface AIPrediction {
  id: string;
  type: 'maintenance' | 'performance' | 'fault';
  title: string;
  description: string;
  probability: number;
  estimatedDate: string;
  recommendation: string;
}

export const mockPredictions: AIPrediction[] = [
  {
    id: '1',
    type: 'maintenance',
    title: 'Nettoyage des panneaux recommandé',
    description: 'Baisse progressive de luminosité captée par BH1750 (-15% sur 30 jours)',
    probability: 85,
    estimatedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    recommendation: 'Planifier un nettoyage dans les 7 prochains jours',
  },
  {
    id: '2',
    type: 'fault',
    title: 'Risque de surchauffe du panneau',
    description: 'DS18B20 détecte une température dépassant régulièrement 70°C',
    probability: 68,
    estimatedDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    recommendation: "Vérifier la ventilation et l'emplacement du panneau",
  },
  {
    id: '3',
    type: 'performance',
    title: "Optimisation possible de l'angle",
    description: "BH1750 indique un angle d'inclinaison non optimal pour la saison",
    probability: 78,
    estimatedDate: new Date().toISOString(),
    recommendation: "Ajuster l'angle de 5-8° pour améliorer le rendement",
  },
];

// ─── Stats système ────────────────────────────────────────────────────────────

export interface SystemStats {
  totalEnergy24h: number;
  currentPower: number;
  efficiency: number;
  uptime: number;
  co2Saved: number;
  revenue: number;
}

export function generateSystemStats(currentData: SensorData): SystemStats {
  return {
    totalEnergy24h: currentData.calculated.energy24h,
    currentPower:   currentData.calculated.power,
    efficiency:     currentData.calculated.efficiency,
    uptime:         99.4,
    co2Saved:       (currentData.calculated.energy24h / 1000) * 0.5,
    revenue:        (currentData.calculated.energy24h / 1000) * 0.4,
  };
}

// ─── Hardware Specs ───────────────────────────────────────────────────────────

export const hardwareSpecs = {
  microcontroller: {
    model:     'ESP32-WROOM-32U',
    chip:      'ESP32-D0WD',
    frequency: '240 MHz',
    flash:     '4 MB',
    wifi:      '802.11 b/g/n (2.4 GHz)',
    gpio:      30,
    adc:       '12-bit (0-4095)',
  },
  sensors: {
    ds18b20: {
      name:      'DS18B20',
      range:     '-55°C à +125°C',
      accuracy:  '±0.5°C',
      interface: '1-Wire',
      pin:       'GPIO 4',
    },
    bh1750: {
      name:      'BH1750',
      range:     '1-65535 lux',
      interface: 'I2C',
      address:   '0x23',
      pins:      { sda: 'GPIO 21', scl: 'GPIO 22' },
    },
    acs712: {
      name:        'ACS712',
      model:       'ACS712-05B',
      range:       '±5A',
      sensitivity: '185 mV/A',
      interface:   'Analogique (ADC)',
      pin:         'GPIO 34',
    },
    voltageDivider: {
      name:       'Pont diviseur de tension',
      r1:         '30kΩ',
      r2:         '10kΩ',
      maxVoltage: '13.2V',
      adcPin:     'GPIO 34',
    },
  },
};