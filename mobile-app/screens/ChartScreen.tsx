import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, ActivityIndicator, LayoutChangeEvent, TouchableOpacity, Alert } from 'react-native';
import { ref, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import { database } from '../firebase';
import { LineChart } from 'react-native-chart-kit';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

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

type RootStackParamList = {
  Home: undefined;
  Login: undefined;
  Database: undefined;
  Chart: undefined;
  CatHealth: undefined;
};

type ChartScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Chart'>;

export default function ChartScreen() {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [heartRate, setHeartRate] = useState(0);
  const [oxygen, setOxygen] = useState(0);
  const [temperature, setTemperature] = useState(0);
  const [heartRateStatus, setHeartRateStatus] = useState('normal');
  const [temperatureStatus, setTemperatureStatus] = useState('normal');
  const [oxygenStatus, setOxygenStatus] = useState('normal');
  const [timestamps, setTimestamps] = useState<number[]>([]);
  const navigation = useNavigation<ChartScreenNavigationProp>();

  useEffect(() => {
    try {
      // Son 24 saatlik verileri al (yaklaşık 21 veri noktası için limitToLast(21))
      const hayvanVerileriRef = ref(database, 'hayvanVerileri');
      const recentDataQuery = query(hayvanVerileriRef, orderByChild('timestamp'), limitToLast(21)); // 21 veri noktası

      const unsubscribe = onValue(recentDataQuery, (snapshot) => {
        try {
          const data = snapshot.val();
          if (data) {
            const labels: string[] = [];
            const heartRateData: number[] = [];
            const oxygenData: number[] = [];
            const temperatureData: number[] = [];
            const timestampsArr: number[] = [];

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
                heartRateData.push(sensorValue.heartRate || 0);
                oxygenData.push(sensorValue.oxygen || 0);
                temperatureData.push(sensorValue.temperature || 0);
                timestampsArr.push(sensorValue.timestamp);
              });

            // En az bir veri noktası varsa grafiği güncelle
            if (labels.length > 0) {
              setTimestamps(timestampsArr);
              setChartData({
                labels: Array(labels.length).fill(''), 
                datasets: [
                  {
                    data: heartRateData,
                    color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`, // Mavi - Nabız
                  },
                  {
                    data: oxygenData,
                    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`, // Yeşil - Oksijen
                  },
                  {
                    data: temperatureData,
                    color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`, // Turuncu - Sıcaklık
                  },
                ],
              });
              setError(null);

              const lastData = data[Object.keys(data).pop() as string] as SensorData;
              if (lastData) {
                setHeartRate(lastData.heartRate);
                setOxygen(lastData.oxygen);
                setTemperature(lastData.temperature);

                // Nabız durumu
                if (lastData.heartRate > 120) setHeartRateStatus('yüksek');
                else if (lastData.heartRate < 60) setHeartRateStatus('düşük');
                else setHeartRateStatus('normal');

                // Sıcaklık durumu
                if (lastData.temperature > 40) setTemperatureStatus('yüksek');
                else if (lastData.temperature < 36) setTemperatureStatus('düşük');
                else setTemperatureStatus('normal');

                // Oksijen durumu
                if (lastData.oxygen < 90) setOxygenStatus('düşük');
                else setOxygenStatus('normal');
              }
            } else {
              setError('Henüz veri bulunmuyor');
            }
          } else {
            setError('Henüz veri bulunmuyor');
          }
        } catch (err) {
          setError('Veri işlenirken bir hata oluştu');
          console.error('Veri işleme hatası:', err);
        } finally {
          setLoading(false);
        }
      });

      return () => {
        unsubscribe();
      };
    } catch (err) {
      setError('Veri alınırken bir hata oluştu');
      console.error('Veri alma hatası:', err);
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Veriler yükleniyor...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Grafik Görünümü</Text>
      <View
        style={styles.chartContainer}
        onLayout={(event: LayoutChangeEvent) => {
          setContainerWidth(event.nativeEvent.layout.width);
        }}
      >
        {/* Nabız Grafiği */}
        <Text style={styles.chartTitle}>Nabız (BPM)</Text>
        {containerWidth > 0 && (
          <LineChart
            data={{
              labels: chartData.labels,
              datasets: [
                {
                  data: chartData.datasets[0].data,
                  color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`, // Mavi - Nabız
                },
              ],
            }}
            width={containerWidth - 20}
            height={180}
            chartConfig={{
              backgroundColor: '#1a237e',
              backgroundGradientFrom: '#1a237e',
              backgroundGradientTo: '#3949ab',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`, // Mavi - Nabız
              style: { borderRadius: 16 },
              propsForLabels: { fontSize: 8 },
            }}
            bezier
            style={StyleSheet.flatten([styles.chart, { marginLeft: 0 }])}
            yAxisSuffix=""
            yAxisInterval={1}
            segments={5}
            onDataPointClick={({ index }) => {
              let ts = timestamps[index];
              if (ts) {
                
                if (ts < 10000000000) { // 10 haneli ise saniye cinsindedir
                  ts = ts * 1000;
                }
                const date = new Date(ts);
                date.setHours(date.getHours() - 3);
                Alert.alert('Veri Zamanı', date.toLocaleString('tr-TR'));
              }
            }}
          />
        )}
        {/* Oksijen Grafiği */}
        <Text style={styles.chartTitle}>Oksijen (%)</Text>
        {containerWidth > 0 && (
          <LineChart
            data={{
              labels: chartData.labels,
              datasets: [
                {
                  data: chartData.datasets[1].data,
                  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`, // Yeşil - Oksijen
                },
              ],
            }}
            width={containerWidth - 20}
            height={180}
            chartConfig={{
              backgroundColor: '#1a237e',
              backgroundGradientFrom: '#1a237e',
              backgroundGradientTo: '#3949ab',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`, // Yeşil - Oksijen
              style: { borderRadius: 16 },
              propsForLabels: { fontSize: 8 },
            }}
            bezier
            style={StyleSheet.flatten([styles.chart, { marginLeft: 0 }])}
            yAxisSuffix=""
            yAxisInterval={1}
            segments={5}
            onDataPointClick={({ index }) => {
              let ts = timestamps[index];
              if (ts) {
                
                if (ts < 10000000000) { // 10 haneli ise saniye cinsindedir
                  ts = ts * 1000;
                }
                const date = new Date(ts);
                date.setHours(date.getHours() - 3);
                Alert.alert('Veri Zamanı', date.toLocaleString('tr-TR'));
              }
            }}
          />
        )}
        {/* Sıcaklık Grafiği */}
        <Text style={styles.chartTitle}>Sıcaklık (°C)</Text>
        {containerWidth > 0 && (
          <LineChart
            data={{
              labels: chartData.labels,
              datasets: [
                {
                  data: chartData.datasets[2].data,
                  color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`, // Turuncu
                },
              ],
            }}
            width={containerWidth - 20}
            height={180}
            chartConfig={{
              backgroundColor: '#1a237e',
              backgroundGradientFrom: '#1a237e',
              backgroundGradientTo: '#3949ab',
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(255, 152, 0, ${opacity})`,
              style: { borderRadius: 16 },
              propsForLabels: { fontSize: 8 },
            }}
            bezier
            style={StyleSheet.flatten([styles.chart, { marginLeft: 0 }])}
            yAxisSuffix=""
            yAxisInterval={1}
            segments={5}
            onDataPointClick={({ index }) => {
              let ts = timestamps[index];
              if (ts) {
                
                if (ts < 10000000000) { // 10 haneli ise saniye cinsindedir
                  ts = ts * 1000;
                }
                const date = new Date(ts);
                date.setHours(date.getHours() - 3);
                Alert.alert('Veri Zamanı', date.toLocaleString('tr-TR'));
              }
            }}
          />
        )}
      </View>
      <TouchableOpacity 
        style={styles.chartButton}
        onPress={() => navigation.navigate('CatHealth')}
      >
        <Text style={styles.chartButtonText}>Kedi Sağlık Yorumu</Text>
      </TouchableOpacity>
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
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  chartContainer: {
    backgroundColor: '#3949ab',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  chartTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 5,
  },
  legendText: {
    color: '#ffffff',
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a237e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#1a237e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff5252',
    fontSize: 16,
    textAlign: 'center',
  },
  chartButton: {
    backgroundColor: '#3949ab',
    borderRadius: 10,
    padding: 15,
    marginTop: 20,
    alignItems: 'center',
  },
  chartButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 