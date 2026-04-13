import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { ref, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import { database } from '../firebase';
import * as Animatable from 'react-native-animatable';

interface SensorData {
  heartRate: number;
  oxygen: number;
  temperature: number;
  timestamp: number;
}

function durumIkon(yorum: string) {
  if (yorum.includes('Ateşli enfeksiyon')) {
    return (
      <Image
        source={require('../assets/atesli.gif')}
        style={{ width: 80, height: 80, marginBottom: 6, alignSelf: 'center' }}
        contentFit="contain"
      />
    );
  }
  if (yorum.includes('Astım')) {
    return (
      <Image
        source={require('../assets/oksuren.gif')}
        style={{ width: 80, height: 80, marginBottom: 6, alignSelf: 'center' }}
        contentFit="contain"
      />
    );
  }
  if (yorum.includes('Hipotermi')) {
    return (
      <Image
        source={require('../assets/hipotermi.gif')}
        style={{ width: 80, height: 80, marginBottom: 6, alignSelf: 'center' }}
        contentFit="contain"
      />
    );
  }
  if (yorum.includes('İleri seviye şok') || yorum.includes('zehirlenme')) {
    return (
      <Image
        source={require('../assets/zehir.gif')}
        style={{ width: 80, height: 80, marginBottom: 6, alignSelf: 'center' }}
        contentFit="contain"
      />
    );
  }
  if (yorum.includes('Aşırı stres')) {
    return (
      <Image
        source={require('../assets/stresli.gif')}
        style={{ width: 80, height: 80, marginBottom: 6, alignSelf: 'center' }}
        contentFit="contain"
      />
    );
  }
  if (yorum.includes('Solunum bozukluğu')) {
    return (
      <Image
        source={require('../assets/oksuren.gif')}
        style={{ width: 80, height: 80, marginBottom: 6, alignSelf: 'center' }}
        contentFit="contain"
      />
    );
  }
  if (yorum.includes('Tabloda eşleşen')) return <Text style={{fontSize:32,marginBottom:6,alignSelf:'center'}}>✅</Text>;
  return <Text style={{fontSize:32,marginBottom:6,alignSelf:'center'}}>ℹ️</Text>;
}

export default function CatHealthScreen() {
  const [data, setData] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ortalamaRef = ref(database, 'hayvanVerileriOrtalama');
    const recentAveragesQuery = query(ortalamaRef, orderByChild('timestamp'), limitToLast(10));
    const unsubscribe = onValue(recentAveragesQuery, (snapshot) => {
      const val = snapshot.val();
      if (val) {
        const arr = Object.values(val)
          .map((d: any) => d as SensorData)
          .sort((a, b) => b.timestamp - a.timestamp);
        setData(arr);
      } else {
        setData([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const yorumla = (d: SensorData) => {
    let yorumlar: string[] = [];
    let nabiz = 'Normal';
    let sicaklik = 'Normal';
    let spo2 = 'Normal';
    if (d.heartRate > 140) nabiz = 'Yüksek';
    else if (d.heartRate < 120) nabiz = 'Düşük';
    if (d.temperature > 39.5) sicaklik = 'Yüksek';
    else if (d.temperature < 37.5) sicaklik = 'Düşük';
    if (d.oxygen < 90) spo2 = 'Düşük';
    if (nabiz === 'Yüksek' && sicaklik === 'Yüksek' && spo2 === 'Düşük')
      yorumlar.push('Ateşli enfeksiyon, zatürre olabilir.');
    else if (nabiz === 'Yüksek' && sicaklik === 'Normal' && spo2 === 'Düşük')
      yorumlar.push('Astım, kalp yetmezliği olabilir.');
    else if (nabiz === 'Düşük' && sicaklik === 'Düşük' && spo2 === 'Normal')
      yorumlar.push('Hipotermi, şok başlangıcı olabilir.');
    else if (nabiz === 'Düşük' && sicaklik === 'Düşük' && spo2 === 'Düşük')
      yorumlar.push('İleri seviye şok, ağır zehirlenme olabilir.');
    else if (nabiz === 'Yüksek' && sicaklik === 'Yüksek' && spo2 === 'Normal')
      yorumlar.push('Aşırı stres, hipertiroidi olabilir.');
    else if (nabiz === 'Normal' && sicaklik === 'Normal' && spo2 === 'Düşük')
      yorumlar.push('Solunum bozukluğu başlangıcı olabilir.');
    else
      yorumlar.push('Tabloda eşleşen özel bir hastalık durumu yok.');
    return { nabiz, sicaklik, spo2, yorumlar };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Veriler yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.catEmoji}>🐾😺</Text>
        <Text style={styles.title}>Kedi Sağlık Yorumu</Text>
      </View>
      {data.length === 0 ? (
        <Text style={styles.noDataText}>Yeterli veri yok.</Text>
      ) : (
        data.map((d, i) => {
          const { nabiz, sicaklik, spo2, yorumlar } = yorumla(d);
          return (
            <Animatable.View
              key={d.timestamp}
              style={styles.cardShadow}
              animation="fadeInUp"
              delay={i * 120}
              duration={600}
              useNativeDriver
            >
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🕒 {(() => { const date = new Date(d.timestamp * 1000); date.setHours(date.getHours() - 3); return date.toLocaleString('tr-TR'); })()}</Text>
                <View style={styles.paramRow}>
                  <View style={[styles.paramBox, nabiz === 'Yüksek' ? styles.high : nabiz === 'Düşük' ? styles.low : styles.normal]}>
                    <Text style={styles.paramLabel}>Nabız</Text>
                    <Text style={styles.paramValue}>{d.heartRate !== undefined ? d.heartRate.toFixed(3) : ''} <Text style={styles.unit}>BPM</Text></Text>
                    <Text style={styles.paramStatus}>{nabiz}</Text>
                  </View>
                  <View style={[styles.paramBox, sicaklik === 'Yüksek' ? styles.high : sicaklik === 'Düşük' ? styles.low : styles.normal]}>
                    <Text style={styles.paramLabel}>Sıcaklık</Text>
                    <Text style={styles.paramValue}>{d.temperature !== undefined ? d.temperature.toFixed(3) : ''} <Text style={styles.unit}>°C</Text></Text>
                    <Text style={styles.paramStatus}>{sicaklik}</Text>
                  </View>
                  <View style={[styles.paramBox, spo2 === 'Düşük' ? styles.low : styles.normal]}>
                    <Text style={styles.paramLabel}>Oksijen</Text>
                    <Text style={styles.paramValue}>{d.oxygen !== undefined ? d.oxygen.toFixed(3) : ''} <Text style={styles.unit}>%</Text></Text>
                    <Text style={styles.paramStatus}>{spo2}</Text>
                  </View>
                </View>
                <View style={styles.yorumContainer}>
                  {yorumlar.map((y, idx) => (
                    <Animatable.View
                      key={idx}
                      style={[styles.yorumBox, y.includes('Tabloda eşleşen') ? styles.yorumNormal : styles.yorumAlert]}
                      animation="pulse"
                      iterationCount={2}
                      duration={900}
                      delay={i * 200 + idx * 100}
                      useNativeDriver
                    >
                      <View style={styles.yorumIkon}>{durumIkon(y)}</View>
                      <Text style={styles.yorumText}>{y}</Text>
                    </Animatable.View>
                  ))}
                </View>
              </View>
            </Animatable.View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#181f3a',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 10,
  },
  catEmoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  contentContainer: {
    padding: 20,
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 1,
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 25,
    borderRadius: 16,
  },
  card: {
    backgroundColor: '#232b5d',
    borderRadius: 16,
    padding: 18,
  },
  cardTitle: {
    color: '#bbdefb',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  paramBox: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#3949ab',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  paramLabel: {
    color: '#bbdefb',
    fontSize: 13,
    marginBottom: 2,
  },
  paramValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  unit: {
    fontSize: 13,
    color: '#bbdefb',
  },
  paramStatus: {
    fontSize: 13,
    color: '#ffeb3b',
    marginTop: 2,
    fontWeight: 'bold',
  },
  high: {
    borderWidth: 2,
    borderColor: '#ff5252',
  },
  low: {
    borderWidth: 2,
    borderColor: '#2196f3',
  },
  normal: {
    borderWidth: 2,
    borderColor: '#4caf50',
  },
  yorumContainer: {
    marginTop: 10,
  },
  yorumBox: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  yorumAlert: {
    backgroundColor: '#ffebee',
  },
  yorumNormal: {
    backgroundColor: '#e8f5e9',
  },
  yorumIkon: {
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    display: 'flex',
  },
  yorumText: {
    color: '#232b5d',
    fontSize: 14,
    flex: 1,
    flexWrap: 'wrap',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#181f3a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 10,
  },
  noDataText: {
    color: '#bbdefb',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
  },
}); 