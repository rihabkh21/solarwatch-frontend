import { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Database,
  Wifi,
  RefreshCw,
} from 'lucide-react';
import { SensorService, ESP32SensorData, SystemAlert } from '../services/firebase';
import { useFirebaseSensorData, useSensorHistory } from '../hooks/useFirebaseSensorData';
import { formatTime, formatFullDate } from '../utils/dateTime';
import { toast } from 'sonner';

/**
 * Exemple d'utilisation de Firebase pour afficher les données temps réel
 * Ce composant montre comment utiliser les services Firebase
 */
export function FirebaseExample() {
  const deviceId = 'ESP32_001'; // ID de votre appareil ESP32
  
  // Hook personnalisé pour les données en temps réel
  const { sensorData, loading, error } = useFirebaseSensorData(deviceId);
  
  // Hook pour l'historique
  const { history, loading: historyLoading } = useSensorHistory(deviceId, 10);
  
  // État pour les alertes
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // Charger les alertes actives
  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoadingAlerts(true);
    const activeAlerts = await SensorService.getActiveAlerts(deviceId);
    setAlerts(activeAlerts);
    setLoadingAlerts(false);
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await SensorService.resolveAlert(alertId);
      toast.success('Alerte résolue avec succès');
      loadAlerts();
    } catch (error) {
      toast.error('Erreur lors de la résolution de l\'alerte');
    }
  };

  const handleRefresh = () => {
    loadAlerts();
    toast.success('Données actualisées');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement des données Firebase...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-6 max-w-md">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Erreur de Connexion</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500 mb-4">
              Assurez-vous que Firebase est correctement configuré dans <code>/src/app/config/firebase.ts</code>
            </p>
            <Button onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Données Firebase en Temps Réel</h1>
          <p className="text-gray-600 mt-1">
            Appareil : <span className="font-semibold">{deviceId}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-green-500 text-white px-4 py-2">
            <Activity className="h-4 w-4 mr-2 animate-pulse" />
            Connecté à Firebase
          </Badge>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Données Capteurs Actuelles */}
      {sensorData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-to-br from-red-50 to-orange-50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Température</p>
              <Database className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {sensorData.ds18b20.temperature.toFixed(1)} °C
            </p>
            <p className="text-xs text-gray-500 mt-1">DS18B20</p>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-yellow-50 to-amber-50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Luminosité</p>
              <Database className="h-4 w-4 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {(sensorData.bh1750.lux / 1000).toFixed(1)} klux
            </p>
            <p className="text-xs text-gray-500 mt-1">BH1750</p>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Tension</p>
              <Database className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {sensorData.voltageDivider.voltage.toFixed(2)} V
            </p>
            <p className="text-xs text-gray-500 mt-1">Pont Diviseur</p>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Courant</p>
              <Database className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {sensorData.currentShunt.current.toFixed(0)} mA
            </p>
            <p className="text-xs text-gray-500 mt-1">Shunt 0.1Ω</p>
          </Card>
        </div>
      )}

      {/* État ESP32 */}
      {sensorData && (
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Wifi className="h-5 w-5 text-blue-600" />
            État ESP32
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-gray-600">Signal WiFi</p>
              <p className="font-semibold text-gray-900">{sensorData.esp32.wifiSignal} dBm</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Uptime</p>
              <p className="font-semibold text-gray-900">
                {Math.floor(sensorData.esp32.uptime / 3600)}h {Math.floor((sensorData.esp32.uptime % 3600) / 60)}m
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Mémoire Libre</p>
              <p className="font-semibold text-gray-900">
                {(sensorData.esp32.freeHeap / 1024).toFixed(1)} KB
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Puissance</p>
              <p className="font-semibold text-green-600">
                {sensorData.calculated.power.toFixed(2)} W
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Dernière MAJ</p>
              <p className="font-semibold text-gray-900">
                {formatTime(new Date(sensorData.timestamp), true)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Alertes Actives */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            Alertes Actives ({alerts.length})
          </h3>
        </div>
        {loadingAlerts ? (
          <p className="text-gray-500 text-center py-4">Chargement des alertes...</p>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
            <p className="text-gray-600">Aucune alerte active</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border-l-4 ${
                  alert.type === 'error'
                    ? 'bg-red-50 border-red-500'
                    : alert.type === 'warning'
                    ? 'bg-yellow-50 border-yellow-500'
                    : 'bg-blue-50 border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{alert.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {alert.timestamp?.toDate ? formatFullDate(alert.timestamp.toDate()) : 'Date inconnue'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => alert.id && handleResolveAlert(alert.id)}
                  >
                    Résoudre
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Historique */}
      <Card className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Database className="h-5 w-5 text-gray-600" />
          Historique Récent (10 dernières entrées)
        </h3>
        {historyLoading ? (
          <p className="text-gray-500 text-center py-4">Chargement de l'historique...</p>
        ) : history.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Aucune donnée historique</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Date/Heure</th>
                  <th className="text-right py-2">Temp (°C)</th>
                  <th className="text-right py-2">Lux</th>
                  <th className="text-right py-2">Voltage (V)</th>
                  <th className="text-right py-2">Courant (mA)</th>
                  <th className="text-right py-2">Puissance (W)</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-2">
                      {entry.timestamp ? formatTime(new Date(entry.timestamp), true) : 'N/A'}
                    </td>
                    <td className="text-right">{entry.ds18b20.temperature.toFixed(1)}</td>
                    <td className="text-right">{Math.floor(entry.bh1750.lux)}</td>
                    <td className="text-right">{entry.voltageDivider.voltage.toFixed(2)}</td>
                    <td className="text-right">{entry.currentShunt.current.toFixed(0)}</td>
                    <td className="text-right font-semibold text-green-600">
                      {entry.calculated.power.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Instructions */}
      <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
        <h3 className="font-semibold text-gray-900 mb-3">📖 Instructions d'Utilisation</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>✅ Les données s'actualisent automatiquement en temps réel via Firebase Realtime Database</p>
          <p>✅ L'historique est stocké dans Firestore pour les analyses à long terme</p>
          <p>✅ Les alertes sont générées automatiquement si les seuils sont dépassés</p>
          <p>
            ⚙️ Consultez le fichier <code className="bg-white px-2 py-1 rounded">/FIREBASE_SETUP.md</code> pour
            configurer votre propre projet Firebase
          </p>
          <p>
            🔧 Modifiez l'ID de l'appareil dans le code ESP32 et dans ce composant pour connecter votre matériel
          </p>
        </div>
      </Card>
    </div>
  );
}

