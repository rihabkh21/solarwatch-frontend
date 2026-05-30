/**
 * SolarWatch ESP32 Integration
 * 
 * Ce fichier contient les instructions et le code exemple pour intégrer
 * votre ESP32-WROOM-32U avec la plateforme SolarWatch.
 */

// ==================== CONFIGURATION ESP32 ====================

/*
// Configuration WiFi
const char* ssid = "VOTRE_WIFI_SSID";
const char* password = "VOTRE_MOT_DE_PASSE_WIFI";

// URL de l'API Backend
const char* serverUrl = "https://europe-west1-YOUR_PROJECT_ID.cloudfunctions.net/api/sensor-data";

// Configuration des pins
#define DS18B20_PIN 4          // GPIO 4 (1-Wire)
#define BH1750_SDA 21          // GPIO 21 (I2C SDA)
#define BH1750_SCL 22          // GPIO 22 (I2C SCL)
#define VOLTAGE_ADC_PIN 34     // GPIO 34 (ADC1_CH6)
#define CURRENT_ADC_PIN 35     // GPIO 35 (ADC1_CH7)

// Configuration du pont diviseur de tension
const float R1 = 30000.0;      // 30kΩ
const float R2 = 10000.0;      // 10kΩ
const float ADC_RESOLUTION = 4095.0;  // 12-bit ADC
const float ADC_VREF = 3.3;    // Tension de référence

// Configuration du shunt de courant
const float SHUNT_RESISTANCE = 0.1;  // 0.1Ω

*/

// ==================== STRUCTURE DE DONNÉES ====================

/*
Structure JSON à envoyer à l'API:

{
  "esp32": {
    "model": "ESP32-WROOM-32U",
    "wifiSignal": -45,         // Signal WiFi en dBm
    "uptime": 3600,            // Uptime en secondes
    "freeHeap": 180000,        // Mémoire libre en bytes
    "voltage": 4.98            // Tension d'alimentation USB
  },
  "ds18b20": {
    "temperature": 45.3,       // Température du panneau en °C
    "address": "28:FF:12:34:56:78:90:AB"  // Adresse unique du capteur
  },
  "bh1750": {
    "lux": 65000,              // Luminosité en lux
    "mode": "Continuous_H_Res_Mode",
    "lightLevel": "bright"     // dark | dim | normal | bright
  },
  "voltageDivider": {
    "voltage": 8.45,           // Tension du panneau en V
    "voltageRaw": 2048,        // Valeur ADC brute (0-4095)
    "r1": "30kΩ",
    "r2": "10kΩ"
  },
  "currentShunt": {
    "current": 250,            // Courant en mA
    "voltageDropMv": 25.0,     // Chute de tension en mV
    "shuntResistance": 0.1     // Résistance du shunt en Ω
  },
  "calculated": {
    "power": 2.11,             // Puissance en W
    "energy24h": 35.5,         // Énergie sur 24h en Wh
    "efficiency": 14.2         // Rendement en %
  }
}
*/

// ==================== CODE ARDUINO EXEMPLE ====================

/*
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Wire.h>
#include <BH1750.h>

// Configuration WiFi
const char* ssid = "VOTRE_WIFI_SSID";
const char* password = "VOTRE_MOT_DE_PASSE_WIFI";
const char* serverUrl = "https://europe-west1-YOUR_PROJECT_ID.cloudfunctions.net/api/sensor-data";

// Pins
#define DS18B20_PIN 4
#define VOLTAGE_ADC_PIN 34
#define CURRENT_ADC_PIN 35

// Capteurs
OneWire oneWire(DS18B20_PIN);
DallasTemperature ds18b20(&oneWire);
BH1750 bh1750;

// Variables
const float R1 = 30000.0;
const float R2 = 10000.0;
const float SHUNT_RESISTANCE = 0.1;

void setup() {
  Serial.begin(115200);
  
  // Initialiser WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connecté!");
  
  // Initialiser capteurs
  ds18b20.begin();
  Wire.begin();
  bh1750.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
  
  // Configurer ADC
  analogReadResolution(12);
}

void loop() {
  // Lire les capteurs
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
  uint8_t addr[8];
  ds18b20.getAddress(addr, 0);
  char addressStr[24];
  sprintf(addressStr, "%02X:%02X:%02X:%02X:%02X:%02X:%02X:%02X", 
          addr[0], addr[1], addr[2], addr[3], addr[4], addr[5], addr[6], addr[7]);
  doc["ds18b20"]["address"] = addressStr;
  
  doc["bh1750"]["lux"] = lux;
  doc["bh1750"]["mode"] = "Continuous_H_Res_Mode";
  if (lux < 10) doc["bh1750"]["lightLevel"] = "dark";
  else if (lux < 1000) doc["bh1750"]["lightLevel"] = "dim";
  else if (lux < 20000) doc["bh1750"]["lightLevel"] = "normal";
  else doc["bh1750"]["lightLevel"] = "bright";
  
  doc["voltageDivider"]["voltage"] = voltage;
  doc["voltageDivider"]["voltageRaw"] = voltageRaw;
  doc["voltageDivider"]["r1"] = "30kΩ";
  doc["voltageDivider"]["r2"] = "10kΩ";
  
  doc["currentShunt"]["current"] = current;
  doc["currentShunt"]["voltageDropMv"] = voltageDropMv;
  doc["currentShunt"]["shuntResistance"] = SHUNT_RESISTANCE;
  
  doc["calculated"]["power"] = power;
  doc["calculated"]["energy24h"] = 0; // À calculer côté serveur
  doc["calculated"]["efficiency"] = 14.2; // À calculer
  
  // Envoyer les données
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    int httpResponseCode = http.POST(jsonString);
    
    if (httpResponseCode > 0) {
      Serial.printf("Données envoyées! Code: %d\n", httpResponseCode);
    } else {
      Serial.printf("Erreur d'envoi: %s\n", http.errorToString(httpResponseCode).c_str());
    }
    
    http.end();
  }
  
  // Attendre 3 secondes avant la prochaine lecture
  delay(3000);
}
*/

// ==================== BIBLIOTHÈQUES REQUISES ====================

/*
Installer via Arduino Library Manager:

1. DallasTemperature by Miles Burton
2. OneWire by Jim Studt, Tom Pollard
3. BH1750 by Christopher Laws
4. ArduinoJson by Benoit Blanchon (version 6.x)

Ou via PlatformIO:

[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps = 
    milesburton/DallasTemperature@^3.11.0
    paulstoffregen/OneWire@^2.3.7
    claws/BH1750@^1.3.0
    bblanchon/ArduinoJson@^6.21.3
*/

// ==================== SCHÉMA DE CONNEXION ====================

/*
ESP32-WROOM-32U Pinout:

DS18B20 (Capteur de température):
  - VCC  → 3.3V
  - GND  → GND
  - DATA → GPIO 4 (avec résistance pull-up 4.7kΩ vers 3.3V)

BH1750 (Capteur de luminosité):
  - VCC → 3.3V
  - GND → GND
  - SDA → GPIO 21
  - SCL → GPIO 22

Pont Diviseur de Tension (Panneau Solaire):
  - Panneau (+) → R1 (30kΩ) → GPIO 34 + R2 (10kΩ) → GND
  - Note: Voltage max mesurable = 13.2V (avec 3.3V ref)

Shunt de Courant (0.1Ω):
  - Panneau (+) → Shunt → Charge
  - GPIO 35 mesure la chute de tension aux bornes du shunt
  - Note: Current max = 1A (avec 3.3V ref et 0.1Ω)

Alimentation ESP32:
  - USB-C → 5V régulé à 3.3V par le régulateur interne
*/

export const ESP32_DOCUMENTATION = {
  title: "Documentation ESP32 pour SolarWatch",
  version: "1.0.0",
  lastUpdated: "2026-02-21",
  
  hardware: {
    microcontroller: "ESP32-WROOM-32U",
    wifi: "802.11 b/g/n avec antenne U.FL externe",
    power: "5V USB-C (500mA)",
    sensors: [
      "DS18B20 - Température (1-Wire)",
      "BH1750 - Luminosité (I2C)",
      "Pont diviseur 30kΩ/10kΩ - Tension",
      "Shunt 0.1Ω - Courant"
    ]
  },
  
  apiEndpoint: "/sensor-data",
  updateInterval: "3 secondes",
  dataFormat: "JSON",
};
