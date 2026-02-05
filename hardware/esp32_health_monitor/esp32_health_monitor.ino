/**
 * ESP32 Health Monitoring System
 * Multi-sensor health monitoring with WiFi connectivity
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <MAX30105.h>
#include <heartRate.h>
#include <DS18B20.h>
#include <OneWire.h>
#include <BluetoothSerial.h>

// WiFi Configuration
const char* WIFI_SSID = "your_wifi_ssid";
const char* WIFI_PASSWORD = "your_wifi_password";
const char* SERVER_URL = "http://your-server-ip:5000/api/health-data";

// Device Configuration
const char* DEVICE_ID = "ESP32-001";
const char* PATIENT_ID = "PAT-001";
const int DATA_TRANSMISSION_INTERVAL = 5000; // 5 seconds
const int HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Pins
const int ONE_WIRE_BUS = 4; // DS18B20 pin
const int BUZZER_PIN = 2;
const int LED_PIN = 32;
const int BUTTON_PIN = 35;

// Sensor Objects
MAX30105 particleSensor;
DS18B20 ds18b20(ONE_WIRE_BUS);
BluetoothSerial SerialBT;

// Variables
unsigned long lastTransmitTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastButtonPress = 0;

int heartRate = 0;
int spo2 = 0;
float temperature = 0.0;
int systolic = 0;
int diastolic = 0;

bool wifiConnected = false;
bool buzzerActive = false;

// Heart rate calculation
const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
float beatsPerMinute;
int beatAvg;

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== ESP32 Health Monitor Starting ===");
  
  // Initialize pins
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  // Initialize sensors
  initMAX30102();
  initDS18B20();
  
  // Initialize Bluetooth
  SerialBT.begin("ESP32-HealthMonitor");
  Serial.println("Bluetooth initialized");
  
  // Connect to WiFi
  connectWiFi();
  
  Serial.println("=== Setup Complete ===\n");
}

void loop() {
  unsigned long currentTime = millis();
  
  // Handle button press (emergency alert)
  if (digitalRead(BUTTON_PIN) == LOW && currentTime - lastButtonPress > 2000) {
    lastButtonPress = currentTime;
    triggerEmergencyAlert();
  }
  
  // Read sensors
  readHeartRate();
  readTemperature();
  estimateBloodPressure();
  
  // Transmit data periodically
  if (currentTime - lastTransmitTime > DATA_TRANSMISSION_INTERVAL) {
    lastTransmitTime = currentTime;
    transmitHealthData();
  }
  
  // Send heartbeat
  if (currentTime - lastHeartbeatTime > HEARTBEAT_INTERVAL) {
    lastHeartbeatTime = currentTime;
    sendHeartbeat();
  }
  
  // Check for alerts
  checkAlerts();
  
  // Bluetooth processing
  if (SerialBT.available()) {
    handleBluetoothCommand(SerialBT.read());
  }
  
  delay(100); // Small delay for stability
}

void initMAX30102() {
  Serial.print("Initializing MAX30102... ");
  
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("FAILED");
    while (1);
  }
  
  Serial.println("SUCCESS");
  
  // Configure sensor
  particleSensor.setup();
  particleSensor.setPulseAmplitudeRed(0x0A);
  particleSensor.setPulseAmplitudeGreen(0);
}

void initDS18B20() {
  Serial.print("Initializing DS18B20... ");
  ds18b20.begin();
  Serial.println("SUCCESS");
}

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println(" CONNECTED");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println(" FAILED");
    wifiConnected = false;
  }
}

void readHeartRate() {
  long irValue = particleSensor.getIR();
  
  if (checkForBeat(irValue) == true) {
    long delta = millis() - lastBeat;
    lastBeat = millis();
    beatsPerMinute = 60 / (delta / 1000.0);
    
    if (beatsPerMinute > 20 && beatsPerMinute < 255) {
      rates[rateSpot++] = (byte)beatsPerMinute;
      rateSpot %= RATE_SIZE;
      
      beatAvg = 0;
      for (byte x = 0; x < RATE_SIZE; x++) {
        beatAvg += rates[x];
      }
      beatAvg /= RATE_SIZE;
      
      heartRate = beatAvg;
    }
  }
  
  // Read SpO2
  spo2 = readSpO2();
  
  // Print to serial for debugging
  if (irValue < 50000) {
    Serial.println(" No finger detected");
  } else {
    Serial.print("Heart Rate: ");
    Serial.print(heartRate);
    Serial.print(" bpm, SpO2: ");
    Serial.print(spo2);
    Serial.println("%");
  }
}

int readSpO2() {
  // Simple SpO2 estimation based on IR/Red ratio
  // In production, use proper SpO2 algorithm
  int irValue = particleSensor.getIR();
  int redValue = particleSensor.getRed();
  
  if (irValue > 50000 && redValue > 50000) {
    float ratio = (float)redValue / irValue;
    int spo2Value = 100 - (ratio * 5);
    return constrain(spo2Value, 0, 100);
  }
  return 0;
}

void readTemperature() {
  temperature = ds18b20.getTempC();
  
  Serial.print("Temperature: ");
  Serial.print(temperature, 1);
  Serial.println("°C");
}

void estimateBloodPressure() {
  // Non-invasive blood pressure estimation
  // This is a simplified estimation - actual BP requires calibration
  // In production, use proper NIBP algorithm or dedicated BP sensor
  
  if (heartRate > 0 && heartRate < 120) {
    // Simple estimation based on heart rate and age
    systolic = 100 + (heartRate * 0.5) + random(-10, 10);
    diastolic = 60 + (heartRate * 0.25) + random(-5, 5);
  } else {
    systolic = 120;
    diastolic = 80;
  }
  
  Serial.print("Blood Pressure: ");
  Serial.print(systolic);
  Serial.print("/");
  Serial.print(diastolic);
  Serial.println(" mmHg");
}

void transmitHealthData() {
  if (!wifiConnected) {
    connectWiFi();
    if (!wifiConnected) return;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    
    // Create JSON payload
    String payload = "{";
    payload += "\"patientId\":\"" + String(PATIENT_ID) + "\",";
    payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
    payload += "\"heartRate\":" + String(heartRate) + ",";
    payload += "\"temperature\":" + String(temperature, 1) + ",";
    payload += "\"spo2\":" + String(spo2) + ",";
    payload += "\"bloodPressure\":{";
    payload += "\"systolic\":" + String(systolic) + ",";
    payload += "\"diastolic\":" + String(diastolic);
    payload += "}";
    payload += "}";
    
    int httpResponseCode = http.POST(payload);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Data transmitted successfully. Response: " + response);
      
      // Check for server commands
      if (response.indexOf("alert") > 0) {
        triggerLocalAlert();
      }
    } else {
      Serial.print("HTTP Error: ");
      Serial.println(httpResponseCode);
    }
    
    http.end();
  }
}

void sendHeartbeat() {
  if (!wifiConnected) return;
  
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String heartbeatUrl = String(SERVER_URL);
    heartbeatUrl.replace("/health-data", "/devices/heartbeat");
    
    http.begin(heartbeatUrl);
    http.addHeader("Content-Type", "application/json");
    
    String payload = "{\"deviceId\":\"" + String(DEVICE_ID) + "\",\"status\":\"online\"}";
    
    http.POST(payload);
    http.end();
  }
}

void checkAlerts() {
  // Local alert thresholds
  bool alert = false;
  String alertMessage = "";
  
  if (heartRate > 100 || heartRate < 50) {
    alert = true;
    alertMessage = "Abnormal heart rate: " + String(heartRate);
  }
  
  if (temperature > 38.0 || temperature < 35.0) {
    alert = true;
    alertMessage = "Abnormal temperature: " + String(temperature, 1);
  }
  
  if (spo2 < 92 && spo2 > 0) {
    alert = true;
    alertMessage = "Low SpO2: " + String(spo2);
  }
  
  if (systolic > 140 || diastolic > 90) {
    alert = true;
    alertMessage = "High blood pressure: " + String(systolic) + "/" + String(diastolic);
  }
  
  if (alert && !buzzerActive) {
    triggerLocalAlert();
    sendAlertToServer(alertMessage);
  }
}

void triggerLocalAlert() {
  buzzerActive = true;
  
  // Flash LED
  for (int i = 0; i < 10; i++) {
    digitalWrite(LED_PIN, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(200);
    digitalWrite(LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    delay(200);
  }
  
  buzzerActive = false;
}

void triggerEmergencyAlert() {
  Serial.println("EMERGENCY BUTTON PRESSED!");
  
  buzzerActive = true;
  
  // Continuous buzzer
  digitalWrite(LED_PIN, HIGH);
  for (int i = 0; i < 30; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
  digitalWrite(LED_PIN, LOW);
  buzzerActive = false;
  
  // Send emergency alert
  sendAlertToServer("EMERGENCY BUTTON PRESSED");
}

void sendAlertToServer(String message) {
  if (!wifiConnected) return;
  
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String alertUrl = String(SERVER_URL);
    alertUrl.replace("/health-data", "/alerts");
    
    http.begin(alertUrl);
    http.addHeader("Content-Type", "application/json");
    
    String payload = "{";
    payload += "\"patientId\":\"" + String(PATIENT_ID) + "\",";
    payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
    payload += "\"type\":\"emergency\",";
    payload += "\"severity\":\"critical\",";
    payload += "\"title\":\"Emergency Alert\",";
    payload += "\"message\":\"" + message + "\"";
    payload += "}";
    
    http.POST(payload);
    http.end();
  }
}

void handleBluetoothCommand(char command) {
  Serial.print("Bluetooth command: ");
  Serial.println(command);
  
  switch (command) {
    case 'S': // Status
      SerialBT.print("HR:");
      SerialBT.print(heartRate);
      SerialBT.print(" SP:");
      SerialBT.print(spo2);
      SerialBT.print(" TP:");
      SerialBT.print(temperature, 1);
      SerialBT.print(" BP:");
      SerialBT.print(systolic);
      SerialBT.print("/");
      SerialBT.println(diastolic);
      break;
      
    case 'T': // Trigger alert
      triggerLocalAlert();
      break;
      
    case 'R': // Reset
      ESP.restart();
      break;
  }
}
