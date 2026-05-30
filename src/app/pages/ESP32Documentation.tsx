import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { 
  CircuitBoard, 
  Wifi, 
  Thermometer, 
  Sun, 
  Zap,
  Cable,
  Copy,
  Download,
  CheckCircle,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function ESP32Documentation() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const apiEndpoint =
    import.meta.env.VITE_FIREBASE_FUNCTIONS_API_ENDPOINT ||
    `https://europe-west1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/api/sensor-data`;

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    toast.success('Code copié!');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const arduinoCode = `#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Wire.h>
#include <BH1750.h>

// Configuration WiFi
const char* ssid = "VOTRE_WIFI_SSID";
const char* password = "VOTRE_MOT_DE_PASSE_WIFI";
const char* serverUrl = "${apiEndpoint}";

// Pins
#define DS18B20_PIN 4
#define VOLTAGE_ADC_PIN 34
#define CURRENT_ADC_PIN 35

// Capteurs
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);
BH1750 bh1750;

// Configuration
const float R1 = 30000.0;
const float R2 = 10000.0;
const float SHUNT_RESISTANCE = 0.1;

void setup() {
  Serial.begin(115200);
  
  // WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi connecté!");
  
  // Capteurs
  ds18b20.begin();
  Wire.begin();
  bh1750.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  analogReadResolution(12);
}

void loop() {
  // Lire capteurs
  ds18b20.requestTemperatures();
  float temperature = ds18b20.getTempCByIndex(0);
  float lux = bh1750.readLightLevel();
  
  int voltageRaw = analogRead(VOLTAGE_ADC_PIN);
  float voltage = (voltageRaw / 4095.0) * 3.3 * ((R1 + R2) / R2);
  
  int currentRaw = analogRead(CURRENT_ADC_PIN);
  float voltageDropMv = (currentRaw / 4095.0) * 3300.0;
  float current = voltageDropMv / (SHUNT_RESISTANCE * 1000.0);
  float power = voltage * (current / 1000.0);
  
  // Créer JSON
  StaticJsonDocument<1024> doc;
  doc["esp32"]["model"] = "ESP32-WROOM-32U";
  doc["esp32"]["wifiSignal"] = WiFi.RSSI();
  doc["esp32"]["uptime"] = millis() / 1000;
  doc["esp32"]["freeHeap"] = ESP.getFreeHeap();
  doc["esp32"]["voltage"] = 4.98;
  
  doc["ds18b20"]["temperature"] = temperature;
  doc["bh1750"]["lux"] = lux;
  doc["voltageDivider"]["voltage"] = voltage;
  doc["voltageDivider"]["voltageRaw"] = voltageRaw;
  doc["currentShunt"]["current"] = current;
  doc["currentShunt"]["voltageDropMv"] = voltageDropMv;
  doc["calculated"]["power"] = power;
  
  // Envoyer données
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    int httpResponseCode = http.POST(jsonString);
    Serial.printf("Code réponse: %d\\n", httpResponseCode);
    
    http.end();
  }
  
  delay(3000); // Mise à jour toutes les 3s
}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Documentation ESP32</h1>
        <p className="text-gray-600 mt-1">
          Guide complet d'intégration ESP32-WROOM-32U avec SolarWatch
        </p>
      </div>

      {/* API Endpoint */}
      <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Wifi className="h-5 w-5 text-blue-600" />
            Point d'accès API
          </h2>
          <Badge className="bg-blue-600 text-white">POST</Badge>
        </div>
        <div className="bg-white p-4 rounded-lg border border-blue-200 flex items-center justify-between">
          <code className="text-sm text-gray-700 break-all">{apiEndpoint}</code>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyToClipboard(apiEndpoint, 'api')}
            className="ml-4 flex-shrink-0"
          >
            {copiedSection === 'api' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-sm text-gray-600 mt-3">
          ⚡ Fréquence recommandée : Toutes les 3 secondes
        </p>
      </Card>

      {/* Hardware Specs */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <CircuitBoard className="h-5 w-5 text-purple-600" />
          Matériel requis
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Microcontrôleur</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• ESP32-WROOM-32U</li>
              <li>• Antenne U.FL externe</li>
              <li>• USB-C pour alimentation</li>
              <li>• 520KB SRAM, 4MB Flash</li>
            </ul>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Capteurs</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-red-600" />
                DS18B20 (Température)
              </li>
              <li className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-yellow-600" />
                BH1750 (Luminosité)
              </li>
              <li className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-purple-600" />
                Pont diviseur 30kΩ/10kΩ
              </li>
              <li className="flex items-center gap-2">
                <Cable className="h-4 w-4 text-blue-600" />
                Shunt 0.1Ω
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Pinout */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Schéma de connexion</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <Thermometer className="h-5 w-5 text-red-600" />
                <h3 className="font-semibold text-gray-900">DS18B20</h3>
              </div>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• VCC → 3.3V</li>
                <li>• GND → GND</li>
                <li>• DATA → GPIO 4</li>
                <li className="text-xs text-red-600">⚠️ Pull-up 4.7kΩ requis</li>
              </ul>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <Sun className="h-5 w-5 text-yellow-600" />
                <h3 className="font-semibold text-gray-900">BH1750</h3>
              </div>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• VCC → 3.3V</li>
                <li>• GND → GND</li>
                <li>• SDA → GPIO 21</li>
                <li>• SCL → GPIO 22</li>
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-gray-900">Pont Diviseur</h3>
              </div>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Panneau (+) → R1 (30kΩ)</li>
                <li>• R1 → GPIO 34 + R2 (10kΩ)</li>
                <li>• R2 → GND</li>
                <li className="text-xs text-purple-600">📊 Max: 13.2V</li>
              </ul>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Cable className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Shunt Courant</h3>
              </div>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Panneau (+) → Shunt 0.1Ω</li>
                <li>• Shunt → Charge</li>
                <li>• GPIO 35 mesure V_drop</li>
                <li className="text-xs text-blue-600">📊 Max: 1A</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>

      {/* Arduino Code */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Code Arduino complet</h2>
          <Button
            size="sm"
            onClick={() => copyToClipboard(arduinoCode, 'arduino')}
          >
            {copiedSection === 'arduino' ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Copié!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copier le code
              </>
            )}
          </Button>
        </div>
        <div className="bg-gray-900 p-4 rounded-lg overflow-x-auto">
          <pre className="text-sm text-green-400 font-mono whitespace-pre">
            {arduinoCode}
          </pre>
        </div>
      </Card>

      {/* Libraries */}
      <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <h2 className="text-lg font-bold text-gray-900 mb-4">📚 Bibliothèques requises</h2>
        <div className="space-y-2 text-sm">
          <p className="font-medium text-gray-900">
            Installer via Arduino Library Manager :
          </p>
          <ul className="space-y-1 text-gray-700 ml-4">
            <li>• <code className="bg-white px-2 py-1 rounded">DallasTemperature</code> by Miles Burton</li>
            <li>• <code className="bg-white px-2 py-1 rounded">OneWire</code> by Jim Studt</li>
            <li>• <code className="bg-white px-2 py-1 rounded">BH1750</code> by Christopher Laws</li>
            <li>• <code className="bg-white px-2 py-1 rounded">ArduinoJson</code> v6.x by Benoit Blanchon</li>
          </ul>
        </div>
      </Card>

      {/* Tips */}
      <Card className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
        <h2 className="text-lg font-bold text-gray-900 mb-4">💡 Conseils importants</h2>
        <ul className="space-y-3 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-amber-600 font-bold flex-shrink-0">1.</span>
            <span>Utilisez une alimentation USB-C stable 5V/500mA minimum</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-600 font-bold flex-shrink-0">2.</span>
            <span>Vérifiez la polarité du panneau solaire avant connexion</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-600 font-bold flex-shrink-0">3.</span>
            <span>Le shunt 0.1Ω doit être de puissance 2W minimum</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-600 font-bold flex-shrink-0">4.</span>
            <span>Testez d'abord sans panneau solaire (simulez avec une alimentation)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-600 font-bold flex-shrink-0">5.</span>
            <span>Surveillez le Serial Monitor pour déboguer la connexion WiFi</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}

