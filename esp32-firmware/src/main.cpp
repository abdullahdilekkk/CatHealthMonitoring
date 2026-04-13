#include <WiFi.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
#include <FirebaseESP32.h>
#include <FirebaseJson.h>
#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <OneWire.h>
#include <DallasTemperature.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

#define WIFI_SSID "Redmi Note 9"
#define WIFI_PASSWORD "123456789a"

#define FIREBASE_HOST "yetimhane-kundakcisi-default-rtdb.europe-west1.firebasedatabase.app"
#define FIREBASE_AUTH "AIzaSyDYzrRdKWXAfo7JGpQpZb58rX_bVxAVV_8"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
unsigned long lastDataSend = 0;
const unsigned long sendInterval = 10000; // 10 saniye
bool signupOK = false;

// NTP için
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 3 * 3600, 60000); // Türkiye için UTC+3

#define ONE_WIRE_BUS 4
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
MAX30105 particleSensor;

// BPM hesaplama için değişkenler
const int BPM_BUFFER_SIZE = 12; // Daha hızlı tepki için buffer boyutu düşürüldü
float bpmBuffer[BPM_BUFFER_SIZE];
int bpmIndex = 0;
float lastValidBPM = 0;
const float BPM_THRESHOLD = 12.0; // Daha hassas threshold
long lastBeat = 0;

// SpO2 hesaplama için değişkenler
const int FILTER_SIZE = 10;
long irBuffer[FILTER_SIZE];
long redBuffer[FILTER_SIZE];
int filterIndex = 0;
float lastValidSPO2 = 0;

// Ortalama için bufferlar
#define AVERAGE_INTERVAL 60000 // 1 dakika (ms)
unsigned long lastAverageSend = 0;
#define MAX_AVG_SAMPLES 6 // 1 dakikada 10 saniyede bir ölçüm = 6 ölçüm

float avgBPMBuffer[MAX_AVG_SAMPLES];
float avgSPO2Buffer[MAX_AVG_SAMPLES];
float avgTempBuffer[MAX_AVG_SAMPLES];
int avgIndex = 0;

// Son ölçülen değerler
float currentBPM = 0;
float currentSPO2 = 0;
float currentTemp = 0;

unsigned long lastTempRead = 0;
const unsigned long tempInterval = 5000;

void initWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi'ye baglaniyor...");
  unsigned long wifiTimeout = millis() + 20000;
  while (WiFi.status() != WL_CONNECTED && millis() < wifiTimeout) {
    Serial.print('.');
    delay(500);
  }
  if(WiFi.status() != WL_CONNECTED) {
    Serial.println("\nWiFi baglantisi basarisiz!");
    ESP.restart();
  } else {
    Serial.println("\nWiFi'ye baglandi");
    Serial.print("IP Adresi: ");
    Serial.println(WiFi.localIP());
  }
}

float calculateBPM(float newBPM) {
  bpmBuffer[bpmIndex] = newBPM;
  bpmIndex = (bpmIndex + 1) % BPM_BUFFER_SIZE;
  float validSum = 0;
  int validCount = 0;
  for (int i = 0; i < BPM_BUFFER_SIZE; i++) {
    if (bpmBuffer[i] > 0) {
      validSum += bpmBuffer[i];
      validCount++;
    }
  }
  if (validCount > 0) {
    float avgBPM = validSum / validCount;
    if (lastValidBPM > 0 && abs(avgBPM - lastValidBPM) > BPM_THRESHOLD) {
      return lastValidBPM;
    }
    lastValidBPM = avgBPM;
    return avgBPM;
  }
  return 0;
}

float calculateSPO2(long irValue, long redValue) {
  irBuffer[filterIndex] = irValue;
  redBuffer[filterIndex] = redValue;
  filterIndex = (filterIndex + 1) % FILTER_SIZE;
  long irAvg = 0;
  long redAvg = 0;
  for (int i = 0; i < FILTER_SIZE; i++) {
    irAvg += irBuffer[i];
    redAvg += redBuffer[i];
  }
  irAvg /= FILTER_SIZE;
  redAvg /= FILTER_SIZE;
  float ratio = (float)redAvg / (float)irAvg;
  float spo2 = 110.0 - (25.0 * ratio);
  if (spo2 > 100) spo2 = 100;
  if (spo2 < 70) spo2 = 70;
  if (lastValidSPO2 > 0 && abs(spo2 - lastValidSPO2) > 5) {
    return lastValidSPO2;
  }
  lastValidSPO2 = spo2;
  return spo2;
}

float readTemperature() {
  sensors.requestTemperatures();
  float tempC = sensors.getTempCByIndex(0);
  if (tempC == DEVICE_DISCONNECTED_C) {
    return -999;
  }
  return tempC;
}

void sendToFirebase(float heartRate, float temperature, float spo2) {
  if (Firebase.ready() && signupOK) {
    unsigned long timestamp = timeClient.getEpochTime();
    FirebaseJson json;
    json.set("heartRate", heartRate);
    json.set("temperature", temperature);
    json.set("oxygen", spo2);
    json.set("timestamp", timestamp);
    String path = "/hayvanVerileri/" + String(timestamp);
    Serial.print("Firebase'e veri gonderiliyor...");
    if (Firebase.setJSON(fbdo, path.c_str(), json)) {
      Serial.println("Basarili");
    } else {
      Serial.print("Hata: ");
      Serial.println(fbdo.errorReason());
    }
  }
}

void sendAverageToFirebase(float avgBPM, float avgTemp, float avgSPO2) {
  if (Firebase.ready() && signupOK) {
    unsigned long timestamp = timeClient.getEpochTime();
    FirebaseJson json;
    json.set("heartRate", avgBPM);
    json.set("temperature", avgTemp);
    json.set("oxygen", avgSPO2);
    json.set("timestamp", timestamp);
    String path = "/hayvanVerileriOrtalama/" + String(timestamp);
    Serial.print("Firebase'e ORTALAMA veri gonderiliyor...");
    if (Firebase.setJSON(fbdo, path.c_str(), json)) {
      Serial.println("Başarılı");
    } else {
      Serial.print("Hata: ");
      Serial.println(fbdo.errorReason());
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  Serial.println("Sistem baslatiliyor...");
  initWiFi();

  // NTP başlat
  timeClient.begin();
  while(!timeClient.update()) {
    timeClient.forceUpdate();
  }

  config.api_key = FIREBASE_AUTH;
  config.database_url = FIREBASE_HOST;
  config.token_status_callback = tokenStatusCallback;
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase baglantisi basarili");
    signupOK = true;
  } else {
    Serial.printf("Firebase baglanti hatasi: %s\n", config.signer.signupError.message.c_str());
  }
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  if (!particleSensor.begin(Wire, 50000)) {
    Serial.println("MAX30105 baslatilamadi!");
    while (1);
  }
  particleSensor.setup();
  particleSensor.setPulseAmplitudeRed(0x0A);
  particleSensor.setPulseAmplitudeIR(0x0A);
  sensors.begin();
  if (sensors.getDeviceCount() == 0) {
    Serial.println("DS18B20 sensoru bulunamadi!");
    while (1);
  }
  lastDataSend = millis();
  lastTempRead = millis();
  lastAverageSend = millis();
}

void loop() {
  // NTP zamanını düzenli güncelle
  timeClient.update();

  // Sürekli nabız ve SpO2 ölçümü
  long irValue = particleSensor.getIR();
  long redValue = particleSensor.getRed();

  if (irValue > 10000) {
    if (checkForBeat(irValue)) {
      long now = millis();
      if (lastBeat > 0) {
        long delta = now - lastBeat;
        if (delta > 300) { // 300 ms = 200 BPM üstü, daha kısa ise ignore
          float beatsPerMinute = 60 / (delta / 1000.0);
          if (beatsPerMinute >= 40 && beatsPerMinute <= 200) {
            currentBPM = calculateBPM(beatsPerMinute);
          }
        }
      }
      lastBeat = now;
    }
    currentSPO2 = calculateSPO2(irValue, redValue);
  }

  // Uzun süre beat algılanmazsa buffer'ı sıfırla
  if (millis() - lastBeat > 10000) { // 10 saniye beat yoksa
    for (int i = 0; i < BPM_BUFFER_SIZE; i++) bpmBuffer[i] = 0;
    lastValidBPM = 0;
    currentBPM = 0;
  }

  // Sıcaklık ölçümünü 5 saniyede bir güncelle
  if (millis() - lastTempRead >= tempInterval) {
    float temp = readTemperature();
    if (temp != -999) {
      currentTemp = temp;
    }
    lastTempRead = millis();
  }

  // Her 10 saniyede bir anlık veri gönder
  if (millis() - lastDataSend >= sendInterval) {
    lastDataSend = millis();
    if (currentBPM > 0 && currentSPO2 > 0 && currentTemp != 0) {
      sendToFirebase(currentBPM, currentTemp, currentSPO2);
      Serial.print("BPM: "); Serial.print(currentBPM);
      Serial.print(" | SpO2: "); Serial.print(currentSPO2);
      Serial.print("% | Sicaklik: "); Serial.print(currentTemp);
      Serial.println("C");

      // Ortalama için buffer'a ekle
      if (avgIndex < MAX_AVG_SAMPLES) {
        avgBPMBuffer[avgIndex] = currentBPM;
        avgSPO2Buffer[avgIndex] = currentSPO2;
        avgTempBuffer[avgIndex] = currentTemp;
        avgIndex++;
      }
    } else {
      Serial.println("Ölçüm başarısız veya parmak algılanmadı.");
    }
  }

  // Her 1 dakikada bir ortalama gönder
  if (millis() - lastAverageSend >= AVERAGE_INTERVAL && avgIndex > 0) {
    lastAverageSend = millis();

    // Ortalama hesapla
    float sumBPM = 0, sumSPO2 = 0, sumTemp = 0;
    for (int i = 0; i < avgIndex; i++) {
      sumBPM += avgBPMBuffer[i];
      sumSPO2 += avgSPO2Buffer[i];
      sumTemp += avgTempBuffer[i];
    }
    float avgBPM = sumBPM / avgIndex;
    float avgSPO2 = sumSPO2 / avgIndex;
    float avgTemp = sumTemp / avgIndex;

    sendAverageToFirebase(avgBPM, avgTemp, avgSPO2);

    // Buffer'ı sıfırla
    avgIndex = 0;
  }

delay(20);
}
