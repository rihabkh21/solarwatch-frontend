/**
 * SolarWatch IoT Platform - Code ESP32-WROOM-32U
 * Projet: solarwatch-8c68a
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Wire.h>
#include <BH1750.h>

// ========================================
// CONFIGURATION WiFi — MODIFIEZ ICI
// ========================================
const char* WIFI_SSID     = "VOTRE_WIFI_SSID";
const char* WIFI_PASSWORD = "VOTRE_WIFI_PASSWORD";

// ========================================
// CONFIGURATION FIREBASE — NOUVEAU PROJET
// ========================================
const char* FIREBASE_HOST     = "https://solarwatch-8c68a-default-rtdb.firebaseio.com";
const char* FIREBASE_ENDPOINT = "https://europe-west1-solarwatch-8c68a.cloudfunctions.net/api/sensor-data";
const char* DEVICE_ID         = "ESP32_001";

// ========================================
// CONFIGURATION CAPTEURS
// ========================================
#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature ds18b20(&oneWire);
DeviceAddress ds18b20Address;
BH1750 lightMeter(0x23);

#define VOLTAGE_PIN 34
#define CURRENT_PIN 35

const float R1              = 30000.0;
const float R2              = 10000.0;
const float ADC_RESOLUTION  = 4095.0;
const float ADC_VOLTAGE     = 3.3;
const float SHUNT_RESISTANCE = 0.1;

const int SEND_INTERVAL = 3000;

unsigned long lastSendTime      = 0;
unsigned long bootTime          = 0;
String        ds18b20AddressStr = "";

// ========================================
// STRUCTURE DE DONNÉES
// ========================================
struct SensorData {
  float         temperature;
  float         lux;
  String        lightLevel;
  float         voltage;
  int           voltageRaw;
  float         current;
  float         voltageDropMv;
  int           wifiSignal;
  unsigned long uptime;
  uint32_t      freeHeap;
  float         power;
  float         energy24h;
  float         efficiency;
  float         revenue24h;
};

// ========================================
// SETUP
// ========================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n================================");
  Serial.println("  SolarWatch — solarwatch-8c68a");
  Serial.println("================================\n");

  bootTime = millis();
  initSensors();
  connectToWiFi();

  Serial.println("\n Système initialisé!");
  Serial.println(" Envoi toutes les 3 secondes...\n");
}

// ========================================
// LOOP
// ========================================
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(" WiFi déconnecté, reconnexion...");
    connectToWiFi();
  }

  if (millis() - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = millis();
    SensorData data = readSensors();
    printSensorData(data);
    sendToFirebase(data);   // → Cloud Functions → Firestore + RTDB
    sendToRTDB(data);       // → Realtime DB directement
  }

  delay(100);
}

// ========================================
// INITIALISATION CAPTEURS
// ========================================
void initSensors() {
  Serial.println(" Initialisation des capteurs...");

  Serial.print("   DS18B20... ");
  ds18b20.begin();
  if (ds18b20.getDeviceCount() > 0) {
    ds18b20.getAddress(ds18b20Address, 0);
    ds18b20AddressStr = getDS18B20Address();
    Serial.println(" ok" + ds18b20AddressStr);
  } else {
    Serial.println("Non détecté");
  }

  Serial.print("   BH1750... ");
  Wire.begin();
  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println("détecté");
  } else {
    Serial.println(" Non détecté");
  }

  Serial.println("   ADC... ");
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
}

// ========================================
// CONNEXION WIFI
// ========================================
void connectToWiFi() {
  Serial.print(" Connexion à ");
  Serial.print(WIFI_SSID);
  Serial.print("... ");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" connecté");
    Serial.println("   IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("  Impossible de se connecter");
  }
}

// ========================================
// LECTURE CAPTEURS
// ========================================
SensorData readSensors() {
  SensorData data;

  // DS18B20
  ds18b20.requestTemperatures();
  data.temperature = ds18b20.getTempCByIndex(0);
  if (data.temperature == DEVICE_DISCONNECTED_C) data.temperature = 0.0;

  // BH1750
  data.lux = lightMeter.readLightLevel();
  if (data.lux < 0) data.lux = 0;
  data.lightLevel = getLightLevel(data.lux);

  // Tension (pont diviseur)
  data.voltageRaw = analogRead(VOLTAGE_PIN);
  float adcV      = (data.voltageRaw / ADC_RESOLUTION) * ADC_VOLTAGE;
  data.voltage    = adcV * ((R1 + R2) / R2);

  // Courant (shunt)
  int   currentRaw      = analogRead(CURRENT_PIN);
  float currentAdcV     = (currentRaw / ADC_RESOLUTION) * ADC_VOLTAGE;
  data.voltageDropMv    = currentAdcV * 1000.0;
  data.current          = (data.voltageDropMv / 1000.0) / SHUNT_RESISTANCE * 1000.0;
  if (data.current < 0) data.current = 0;

  // ESP32
  data.wifiSignal = WiFi.RSSI();
  data.uptime     = (millis() - bootTime) / 1000;
  data.freeHeap   = ESP.getFreeHeap();

  // Calculs
  data.power      = (data.voltage * data.current) / 1000.0;
  data.energy24h  = data.power * 24.0;
  data.efficiency = calculateEfficiency(data.power, data.lux);
  data.revenue24h = (data.energy24h / 1000.0) * 0.130; // Tarif STEG TND/kWh

  return data;
}

// ========================================
// HELPERS
// ========================================
String getLightLevel(float lux) {
  if (lux < 10)   return "dark";
  if (lux < 1000) return "dim";
  if (lux < 50000) return "normal";
  return "bright";
}

float calculateEfficiency(float power, float lux) {
  if (lux < 100) return 0.0;
  float theoreticalPower = (lux / 100000.0) * 10.0;
  if (theoreticalPower == 0) return 0.0;
  float eff = (power / theoreticalPower) * 100.0;
  if (eff > 100) eff = 100;
  if (eff < 0)   eff = 0;
  return eff;
}

String getDS18B20Address() {
  String addr = "";
  for (uint8_t i = 0; i < 8; i++) {
    if (ds18b20Address[i] < 16) addr += "0";
    addr += String(ds18b20Address[i], HEX);
    if (i < 7) addr += ":";
  }
  addr.toUpperCase();
  return addr;
}

// ========================================
// AFFICHER LES DONNÉES
// ========================================
void printSensorData(SensorData data) {
  Serial.println("────────────────────────────────────");
  Serial.printf("  Température:  %.1f °C\n",    data.temperature);
  Serial.printf(" Luminosité:   %.0f lux\n",    data.lux);
  Serial.printf("Tension:       %.2f V\n",       data.voltage);
  Serial.printf(" Courant:       %.0f mA\n",      data.current);
  Serial.printf(" Puissance:     %.2f W\n",       data.power);
  Serial.printf(" Énergie/24h:   %.0f Wh\n",     data.energy24h);
  Serial.printf(" Efficacité:    %.1f %%\n",      data.efficiency);
  Serial.printf(" Revenus/24h:   %.4f TND\n",    data.revenue24h);
  Serial.printf(" WiFi:          %d dBm\n",       data.wifiSignal);
  Serial.println("────────────────────────────────────\n");
}

// ========================================
// ENVOYER VERS CLOUD FUNCTIONS → Firestore + RTDB
// ========================================
void sendToFirebase(SensorData data) {
  if (WiFi.status() != WL_CONNECTED) return;

  StaticJsonDocument<1024> doc;
  doc["deviceId"] = DEVICE_ID;

  JsonObject ds18b20Obj = doc.createNestedObject("ds18b20");
  ds18b20Obj["temperature"] = round(data.temperature * 10) / 10.0;
  ds18b20Obj["address"]     = ds18b20AddressStr;

  JsonObject bh1750Obj = doc.createNestedObject("bh1750");
  bh1750Obj["lux"]        = round(data.lux);
  bh1750Obj["lightLevel"] = data.lightLevel;
  bh1750Obj["mode"]       = "Continuous High Res Mode";

  JsonObject vdObj = doc.createNestedObject("voltageDivider");
  vdObj["voltage"]    = round(data.voltage * 100) / 100.0;
  vdObj["voltageRaw"] = data.voltageRaw;
  vdObj["r1"]         = "30kΩ";
  vdObj["r2"]         = "10kΩ";

  JsonObject csObj = doc.createNestedObject("currentShunt");
  csObj["current"]         = round(data.current);
  csObj["voltageDropMv"]   = round(data.voltageDropMv * 10) / 10.0;
  csObj["shuntResistance"] = SHUNT_RESISTANCE;

  JsonObject esp32Obj = doc.createNestedObject("esp32");
  esp32Obj["model"]      = "ESP32-WROOM-32U";
  esp32Obj["wifiSignal"] = data.wifiSignal;
  esp32Obj["uptime"]     = data.uptime;
  esp32Obj["freeHeap"]   = data.freeHeap;
  esp32Obj["voltage"]    = 5.1;

  JsonObject calcObj = doc.createNestedObject("calculated");
  calcObj["power"]      = round(data.power * 100) / 100.0;
  calcObj["energy24h"]  = round(data.energy24h);
  calcObj["efficiency"] = round(data.efficiency * 10) / 10.0;

  String jsonString;
  serializeJson(doc, jsonString);

  HTTPClient http;
  http.begin(FIREBASE_ENDPOINT);
  http.addHeader("Content-Type", "application/json");

  int code = http.POST(jsonString);
  if (code == 200) {
    Serial.println(" Cloud Functions → Firestore + RTDB OK");
  } else {
    Serial.printf(" Erreur Functions: %d\n", code);
  }
  http.end();
}

// ========================================
// ENVOYER DIRECTEMENT VERS RTDB
// ========================================
void sendToRTDB(SensorData data) {
  if (WiFi.status() != WL_CONNECTED) return;

  StaticJsonDocument<512> doc;
  doc["receivedAt"]  = String(millis());
  doc["deviceId"]    = DEVICE_ID;

  JsonObject ds18b20Obj = doc.createNestedObject("ds18b20");
  ds18b20Obj["temperature"] = data.temperature;
  ds18b20Obj["address"]     = ds18b20AddressStr;

  JsonObject bh1750Obj = doc.createNestedObject("bh1750");
  bh1750Obj["lux"]        = data.lux;
  bh1750Obj["lightLevel"] = data.lightLevel;

  JsonObject vdObj = doc.createNestedObject("voltageDivider");
  vdObj["voltage"]    = data.voltage;
  vdObj["voltageRaw"] = data.voltageRaw;

  JsonObject csObj = doc.createNestedObject("currentShunt");
  csObj["current"]       = data.current;
  csObj["voltageDropMv"] = data.voltageDropMv;

  JsonObject esp32Obj = doc.createNestedObject("esp32");
  esp32Obj["wifiSignal"] = data.wifiSignal;
  esp32Obj["uptime"]     = data.uptime;
  esp32Obj["freeHeap"]   = data.freeHeap;

  JsonObject calcObj = doc.createNestedObject("calculated");
  calcObj["power"]      = data.power;
  calcObj["energy24h"]  = data.energy24h;
  calcObj["efficiency"] = data.efficiency;

  String jsonString;
  serializeJson(doc, jsonString);

  // PUT direct vers Realtime Database
  String url = String(FIREBASE_HOST) + "/sensors/" + DEVICE_ID + "/current.json";

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  int code = http.PUT(jsonString);
  if (code == 200) {
    Serial.println(" RTDB direct OK");
  } else {
    Serial.printf("Erreur RTDB: %d\n", code);
  }
  http.end();
