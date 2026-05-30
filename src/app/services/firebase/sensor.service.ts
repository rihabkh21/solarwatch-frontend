import {
  ref,
  set,
  get,
  onValue,
  push,
  query,
  orderByChild,
  limitToLast,
  remove,
  update,
} from 'firebase/database';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query as firestoreQuery,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { rtdb, db } from '../../config/firebase';

/**
 * Structure des données capteur ESP32
 */
export interface ESP32SensorData {
  timestamp: number;
  ds18b20: {
    temperature: number;
    address: string;
  };
  bh1750: {
    lux: number;
    lightLevel: 'dark' | 'dim' | 'normal' | 'bright';
    mode: string;
  };
  voltageDivider: {
    voltage: number;
    voltageRaw: number;
    r1: string;
    r2: string;
  };
  currentShunt: {
    current: number;
    voltageDropMv: number;
    shuntResistance: number;
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
    revenue24h: number;
  };
}

/**
 * Alerte système
 */
export interface SystemAlert {
  id?: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: any;
  resolved: boolean;
  deviceId: string;
}

/**
 * Configuration ESP32
 */
export interface ESP32Config {
  deviceId: string;
  name: string;
  location: string;
  solarPanelSpecs: {
    voltageRange: string;
    maxPower: number;
  };
  alertThresholds: {
    maxTemperature: number;
    minVoltage: number;
    minCurrent: number;
  };
  active: boolean;
}

/**
 * Service de gestion des données capteurs Firebase
 */
export class SensorService {
  /**
   * Enregistrer des données capteur en temps réel (Realtime Database)
   * Utilisé par l'ESP32 pour envoyer les données
   */
  static async saveSensorData(
    deviceId: string,
    sensorData: ESP32SensorData
  ): Promise<void> {
    try {
      const dataRef = ref(rtdb, `sensors/${deviceId}/current`);
      await set(dataRef, {
        ...sensorData,
        timestamp: Date.now(),
      });

      // Archiver dans l'historique (Firestore)
      await this.archiveSensorData(deviceId, sensorData);
    } catch (error) {
      console.error('Erreur sauvegarde données capteur:', error);
      throw error;
    }
  }

  /**
   * Écouter les données en temps réel d'un appareil
   */
  static listenToSensorData(
    deviceId: string,
    callback: (data: ESP32SensorData | null) => void
  ): () => void {
    const dataRef = ref(rtdb, `sensors/${deviceId}/current`);
    
    const unsubscribe = onValue(dataRef, (snapshot) => {
      const data = snapshot.val();
      callback(data);
    });

    return unsubscribe;
  }

  /**
   * Récupérer les données actuelles d'un appareil
   */
  static async getCurrentSensorData(deviceId: string): Promise<ESP32SensorData | null> {
    try {
      const dataRef = ref(rtdb, `sensors/${deviceId}/current`);
      const snapshot = await get(dataRef);
      return snapshot.val();
    } catch (error) {
      console.error('Erreur récupération données:', error);
      return null;
    }
  }

  /**
   * Archiver les données dans Firestore pour l'historique
   */
  private static async archiveSensorData(
    deviceId: string,
    sensorData: ESP32SensorData
  ): Promise<void> {
    try {
      await addDoc(collection(db, 'sensorHistory'), {
        deviceId,
        ...sensorData,
        timestamp: Timestamp.now(),
      });
    } catch (error) {
      console.error('Erreur archivage données:', error);
    }
  }

  /**
   * Récupérer l'historique des données (Firestore)
   */
  static async getSensorHistory(
    deviceId: string,
    limitCount: number = 100
  ): Promise<ESP32SensorData[]> {
    try {
      const historyRef = collection(db, 'sensorHistory');
      const q = firestoreQuery(
        historyRef,
        where('deviceId', '==', deviceId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as ESP32SensorData);
    } catch (error) {
      console.error('Erreur récupération historique:', error);
      return [];
    }
  }

  /**
   * Créer une alerte
   */
  static async createAlert(alert: Omit<SystemAlert, 'id'>): Promise<string> {
    try {
      const alertRef = await addDoc(collection(db, 'alerts'), {
        ...alert,
        timestamp: Timestamp.now(),
      });
      return alertRef.id;
    } catch (error) {
      console.error('Erreur création alerte:', error);
      throw error;
    }
  }

  /**
   * Récupérer les alertes actives
   */
  static async getActiveAlerts(deviceId?: string): Promise<SystemAlert[]> {
    try {
      const alertsRef = collection(db, 'alerts');
      let q = firestoreQuery(
        alertsRef,
        where('resolved', '==', false),
        orderBy('timestamp', 'desc')
      );

      if (deviceId) {
        q = firestoreQuery(
          alertsRef,
          where('deviceId', '==', deviceId),
          where('resolved', '==', false),
          orderBy('timestamp', 'desc')
        );
      }

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as SystemAlert));
    } catch (error) {
      console.error('Erreur récupération alertes:', error);
      return [];
    }
  }

  /**
   * Résoudre une alerte
   */
  static async resolveAlert(alertId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'alerts', alertId), {
        resolved: true,
        resolvedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Erreur résolution alerte:', error);
      throw error;
    }
  }

  /**
   * Sauvegarder la configuration ESP32
   */
  static async saveESP32Config(config: ESP32Config): Promise<void> {
    try {
      const configRef = doc(db, 'esp32Config', config.deviceId);
      await updateDoc(configRef, config).catch(async () => {
        // Si le document n'existe pas, le créer
        await addDoc(collection(db, 'esp32Config'), config);
      });
    } catch (error) {
      console.error('Erreur sauvegarde config:', error);
      throw error;
    }
  }

  /**
   * Récupérer la configuration ESP32
   */
  static async getESP32Config(deviceId: string): Promise<ESP32Config | null> {
    try {
      const configRef = doc(db, 'esp32Config', deviceId);
      const configDoc = await getDoc(configRef);
      
      if (configDoc.exists()) {
        return configDoc.data() as ESP32Config;
      }
      return null;
    } catch (error) {
      console.error('Erreur récupération config:', error);
      return null;
    }
  }

  /**
   * Récupérer tous les appareils ESP32 configurés
   */
  static async getAllDevices(): Promise<ESP32Config[]> {
    try {
      const devicesSnapshot = await getDocs(collection(db, 'esp32Config'));
      return devicesSnapshot.docs.map(doc => doc.data() as ESP32Config);
    } catch (error) {
      console.error('Erreur récupération appareils:', error);
      return [];
    }
  }

  /**
   * Vérifier les seuils et créer des alertes automatiques
   */
  static async checkThresholdsAndAlert(
    deviceId: string,
    sensorData: ESP32SensorData,
    config: ESP32Config
  ): Promise<void> {
    const alerts: Omit<SystemAlert, 'id'>[] = [];

    // Vérifier température
    if (sensorData.ds18b20.temperature > config.alertThresholds.maxTemperature) {
      alerts.push({
        type: 'warning',
        title: 'Température Élevée',
        message: `Température panneau: ${sensorData.ds18b20.temperature.toFixed(1)}°C (seuil: ${config.alertThresholds.maxTemperature}°C)`,
        timestamp: Timestamp.now(),
        resolved: false,
        deviceId,
      });
    }

    // Vérifier tension
    if (sensorData.voltageDivider.voltage < config.alertThresholds.minVoltage) {
      alerts.push({
        type: 'error',
        title: 'Tension Faible',
        message: `Tension panneau: ${sensorData.voltageDivider.voltage.toFixed(2)}V (seuil: ${config.alertThresholds.minVoltage}V)`,
        timestamp: Timestamp.now(),
        resolved: false,
        deviceId,
      });
    }

    // Vérifier courant
    if (sensorData.currentShunt.current < config.alertThresholds.minCurrent) {
      alerts.push({
        type: 'warning',
        title: 'Courant Faible',
        message: `Courant panneau: ${sensorData.currentShunt.current.toFixed(0)}mA (seuil: ${config.alertThresholds.minCurrent}mA)`,
        timestamp: Timestamp.now(),
        resolved: false,
        deviceId,
      });
    }

    // Créer les alertes
    for (const alert of alerts) {
      await this.createAlert(alert);
    }
  }

  /**
   * Calculer les statistiques sur une période
   */
  static async calculateStats(
    deviceId: string,
    hours: number = 24
  ): Promise<{
    avgPower: number;
    maxPower: number;
    totalEnergy: number;
    avgTemperature: number;
    avgEfficiency: number;
  }> {
    try {
      const history = await this.getSensorHistory(deviceId, hours * 60); // Approximation
      
      if (history.length === 0) {
        return {
          avgPower: 0,
          maxPower: 0,
          totalEnergy: 0,
          avgTemperature: 0,
          avgEfficiency: 0,
        };
      }

      const stats = history.reduce(
        (acc, data) => {
          acc.totalPower += data.calculated.power;
          acc.maxPower = Math.max(acc.maxPower, data.calculated.power);
          acc.totalEnergy += data.calculated.energy24h;
          acc.totalTemperature += data.ds18b20.temperature;
          acc.totalEfficiency += data.calculated.efficiency;
          return acc;
        },
        {
          totalPower: 0,
          maxPower: 0,
          totalEnergy: 0,
          totalTemperature: 0,
          totalEfficiency: 0,
        }
      );

      return {
        avgPower: stats.totalPower / history.length,
        maxPower: stats.maxPower,
        totalEnergy: stats.totalEnergy / history.length,
        avgTemperature: stats.totalTemperature / history.length,
        avgEfficiency: stats.totalEfficiency / history.length,
      };
    } catch (error) {
      console.error('Erreur calcul statistiques:', error);
      return {
        avgPower: 0,
        maxPower: 0,
        totalEnergy: 0,
        avgTemperature: 0,
        avgEfficiency: 0,
      };
    }
  }
}
