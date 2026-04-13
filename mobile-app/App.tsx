import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DatabaseScreen from './screens/DatabaseScreen';
import ChartScreen from './screens/ChartScreen';
import CatHealthScreen from './screens/CatHealthScreen';
import app from './firebase';


type RootStackParamList = {
  Home: undefined;
  Database: undefined;
  Chart: undefined;
  CatHealth: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeScreen({ navigation }: { navigation: any }) {
  React.useEffect(() => {
    navigation.replace('Database');
  }, []);
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Yönlendiriliyor...</Text>
      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1a237e',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Database" 
          component={DatabaseScreen}
          options={{ title: 'Hayvan Takip' }}
        />
        <Stack.Screen 
          name="Chart" 
          component={ChartScreen} 
          options={{ title: 'Grafik Görünümü' }}
        />
        <Stack.Screen 
          name="CatHealth" 
          component={CatHealthScreen} 
          options={{ title: 'Kedi Sağlık Yorumu' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a237e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#ffffff',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    backgroundColor: '#3949ab',
    borderRadius: 10,
    padding: 5,
  },
});
