import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Platform, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { ref, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import { database } from '../firebase';
import { LineChart } from 'react-native-chart-kit';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Database: undefined;
  Chart: undefined;
  CatHealth: undefined;
};

type DatabaseScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Database'>;

const BACKGROUND_FETCH_TASK = 'background-fetch-task';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {

    const currentTemperature = sampleTemperature;
    const currentOxygen = sampleOxygen;

    // Sıcaklık kontrolü
    if (currentTemperature > 39 || currentTemperature < 33) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Sıcaklık Uyarısı!',
          body: `Hayvanın vücut sıcaklığı ${currentTemperature}°C. Acil müdahale gerekebilir!`,
        },
        trigger: null,
      });
    }

    // Oksijen kontrolü
    if (currentOxygen < 84) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Oksijen Uyarısı!',
          body: `Hayvanın oksijen seviyesi %${currentOxygen}. Acil müdahale gerekebilir!`,
        },
        trigger: null,
      });
    } else if (currentOxygen > 100) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Oksijen Uyarısı!',
          body: `Hayvanın oksijen seviyesi %${currentOxygen}. Oksijen seviyesi çok yüksek!`,
        },
        trigger: null,
      });
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Örnek veriler (gerçek uygulamada Firebase'den gelecek burası şu an dümenden)
const sampleTemperature = 90;
const sampleOxygen = 190;
const sampleHeartRate = 120;

interface ChartData {
  labels: string[];
  datasets: {
    data: number[];
    color: (opacity: number) => string;
  }[];
}

interface SensorData {
  heartRate: number;
  oxygen: number;
  temperature: number;
  timestamp: number;
}

export default function DatabaseScreen() {
  const navigation = useNavigation<DatabaseScreenNavigationProp>();
  const [temperature, setTemperature] = useState<number | null>(null);
  const [temperatureStatus, setTemperatureStatus] = useState<'normal' | 'yüksek' | 'düşük'>('normal');
  const [oxygen, setOxygen] = useState<number | null>(null);
  const [oxygenStatus, setOxygenStatus] = useState<'normal' | 'düşük' | 'fazla'>('normal');
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [heartRateStatus, setHeartRateStatus] = useState<'normal' | 'yüksek' | 'düşük'>('normal');

  // Grafik verileri için noktalar
  const [chartData, setChartData] = useState<ChartData>({
    labels: [],
    datasets: [
      {
        data: [],
        color: (opacity = 1) => `rgba(255, 0, 0, ${opacity})`, // Kırmızı - Nabız
      },
      {
        data: [],
        color: (opacity = 1) => `rgba(0, 255, 0, ${opacity})`, // Yeşil - Oksijen
      },
      {
        data: [],
        color: (opacity = 1) => `rgba(0, 0, 255, ${opacity})`, // Mavi - Sıcaklık
      },
    ],
  });

  useEffect(() => {
    // Bildirim izinlerini istedim arka plan bildirimi
    registerForPushNotificationsAsync();

    // Arka plan görevini kaydet
    registerBackgroundFetchAsync();

    // Son 24 saatlik verileri al 30 dakikalık aralıklarla
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const hayvanVerileriRef = ref(database, 'hayvanVerileri');
    const recentDataQuery = query(hayvanVerileriRef, orderByChild('timestamp'), limitToLast(48)); // 48 veri noktası 30 dakikalık aralıklarla

    const unsubscribe = onValue(recentDataQuery, (snapshot) => {
      const data = snapshot.val();
      console.log('Firebase verisi:', data);
      if (data) {
        const labels: string[] = [];
        const heartRateData: number[] = [];
        const oxygenData: number[] = [];
        const temperatureData: number[] = [];

        Object.entries(data)
          .sort(([, a], [, b]) => {
            const sensorA = a as SensorData;
            const sensorB = b as SensorData;
            return sensorA.timestamp - sensorB.timestamp;
          })
          .forEach(([, value]) => {
            const sensorValue = value as SensorData;
            const date = new Date(sensorValue.timestamp);
            const minutes = date.getMinutes();
            const hour = date.getHours();

            labels.push(`${hour}:${minutes < 10 ? '0' + minutes : minutes}`);
            heartRateData.push(sensorValue.heartRate);
            oxygenData.push(sensorValue.oxygen);
            temperatureData.push(sensorValue.temperature);
          });

        setChartData({
          labels,
          datasets: [
            {
              data: heartRateData,
              color: (opacity = 1) => `rgba(255, 0, 0, ${opacity})`,
            },
            {
              data: oxygenData,
              color: (opacity = 1) => `rgba(0, 255, 0, ${opacity})`,
            },
            {
              data: temperatureData,
              color: (opacity = 1) => `rgba(0, 0, 255, ${opacity})`,
            },
          ],
        });

        const lastData = Object.values(data)
          .map((d: any) => d as SensorData)
          .sort((a, b) => b.timestamp - a.timestamp)[0];

        if (lastData) {
          setHeartRate(lastData.heartRate);
          setOxygen(lastData.oxygen);
          setTemperature(lastData.temperature);

          // Nabız durumu
          if (lastData.heartRate > 120) setHeartRateStatus('yüksek');
          else if (lastData.heartRate < 60) setHeartRateStatus('düşük');
          else setHeartRateStatus('normal');

          // Sıcaklık durumu
          if (lastData.temperature >= 33 && lastData.temperature <= 39) setTemperatureStatus('normal');
          else if (lastData.temperature > 39) setTemperatureStatus('yüksek');
          else setTemperatureStatus('düşük');

          // Oksijen durumu
          if (lastData.oxygen >= 84 && lastData.oxygen <= 100) setOxygenStatus('normal');
          else if (lastData.oxygen > 100) setOxygenStatus('fazla');
          else setOxygenStatus('düşük');
        }
      } else {
        setHeartRate(null);
        setOxygen(null);
        setTemperature(null);
      }
    });

    return () => {
      unsubscribe();
      unregisterBackgroundFetchAsync();
    };
  }, []);

  // Bildirim izinlerini alma fonksiyonu
  async function registerForPushNotificationsAsync() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      Alert.alert('Bildirim izni gerekli', 'Uygulamanın arka planda çalışabilmesi için bildirim izni gereklidir.');
    }
  }

  // Arka plan görevini kaydetme fonksiyonu
  async function registerBackgroundFetchAsync() {
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: 15 * 60, 
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (err) {
      console.log("Arka plan görevi kaydedilemedi:", err);
    }
  }

  // Arka plan görevini kaldırma fonksiyonu
  async function unregisterBackgroundFetchAsync() {
    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    } catch (err) {
      console.log("Arka plan görevi kaldırılamadı:", err);
    }
  }

  const getTemperatureColor = () => {
    switch (temperatureStatus) {
      case 'yüksek':
        return '#ff5252';
      case 'düşük':
        return '#2196f3';
      default:
        return '#4caf50';
    }
  };

  const getOxygenColor = () => {
    switch (oxygenStatus) {
      case 'fazla':
        return '#ff5252'; // Kırmızı
      case 'düşük':
        return '#2196f3'; // Mavi
      default:
        return '#4caf50'; // Yeşil - normal
    }
  };

  const getHeartRateColor = () => {
    switch (heartRateStatus) {
      case 'yüksek':
        return '#ff5252';
      case 'düşük':
        return '#2196f3';
      default:
        return '#4caf50';
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#20297A' }} contentContainerStyle={{ padding: 20 }}>
      <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 24 }}>
        Hayvan Takip Verileri
      </Text>

      {/* Nabız */}
      <View style={{ backgroundColor: '#3846A5', borderRadius: 18, padding: 16, marginBottom: 18 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Nabız</Text>
        <View style={{ backgroundColor: getHeartRateColor(), borderRadius: 12, padding: 12, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: 'bold' }}>
            {heartRate !== null ? `${heartRate} BPM` : 'Veri yok'}
          </Text>
          <Text style={{ color: '#fff', fontSize: 18, marginTop: 4 }}>
            {heartRateStatus === 'normal' ? 'Normal' : heartRateStatus === 'yüksek' ? 'Yüksek Nabız!' : 'Düşük Nabız!'}
          </Text>
        </View>
      </View>

      {/* Sıcaklık */}
      <View style={{ backgroundColor: '#3846A5', borderRadius: 18, padding: 16, marginBottom: 18 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Vücut Sıcaklığı</Text>
        <View style={{ backgroundColor: getTemperatureColor(), borderRadius: 12, padding: 12, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: 'bold' }}>
            {temperature !== null ? `${temperature}°C` : 'Veri yok'}
          </Text>
          <Text style={{ color: '#fff', fontSize: 18, marginTop: 4 }}>
            {temperatureStatus === 'normal' ? 'Normal' : temperatureStatus === 'yüksek' ? 'Yüksek Sıcaklık!' : 'Düşük Sıcaklık!'}
          </Text>
        </View>
      </View>

      {/* Oksijen */}
      <View style={{ backgroundColor: '#3846A5', borderRadius: 18, padding: 16, marginBottom: 18 }}>
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Oksijen Saturasyonu</Text>
        <View style={{ backgroundColor: getOxygenColor(), borderRadius: 12, padding: 12, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: 'bold' }}>
            {oxygen !== null ? `${oxygen}%` : 'Veri yok'}
          </Text>
          <Text style={{ color: '#fff', fontSize: 18, marginTop: 4 }}>
            {oxygenStatus === 'normal' ? 'Normal' : oxygenStatus === 'fazla' ? 'Fazla Oksijen!' : 'Düşük Oksijen!'}
          </Text>
        </View>
      </View>

      <TouchableOpacity 
        style={{ backgroundColor: '#3949ab', padding: 15, borderRadius: 10, marginTop: 10, marginBottom: 10 }}
        onPress={() => navigation.navigate('Chart')}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>Grafik Görünümüne Git</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={{ backgroundColor: '#3949ab', padding: 15, borderRadius: 10, marginBottom: 10 }}
        onPress={() => navigation.navigate('CatHealth')}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>Kedi Sağlık Yorumu</Text>
      </TouchableOpacity>

      <Text style={{ color: '#bbdefb', fontSize: 18, textAlign: 'center', marginTop: 20 }}>
        Uygulama arka planda çalışıyor ve verileri kontrol ediyor.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a237e',
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    backgroundColor: '#3949ab',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  headerText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dataContainer: {
    backgroundColor: '#3949ab',
    borderRadius: 10,
    padding: 15,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dataItem: {
    alignItems: 'center',
  },
  dataLabel: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  dataValue: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  dataStatus: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
  },
  chartButton: {
    backgroundColor: '#3949ab',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    marginBottom: 20,
  },
  chartButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptyText: {
    color: '#bbdefb',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
  },
}); 