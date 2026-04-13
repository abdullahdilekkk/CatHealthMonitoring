# Cat Health Monitoring System 🐱

Welcome to the **Cat Health Monitoring System** repository! This project is an IoT-based solution designed to track and monitor the health and environment of your cats. It consists of two main components: an ESP32-based hardware system that collects sensor data, and a cross-platform mobile application to easily view the data and monitor your pet.

## 📁 Repository Structure

- **`esp32-firmware/`**: Contains the C++ code for the ESP32 microcontroller, managed with PlatformIO. It handles sensor readings and backend communication.
- **`mobile-app/`**: A React Native application built with Expo to provide a user-friendly interface for tracking real-time data and alerts regarding your cat's health.

## 🛠 Features

- Real-time environment and activity monitoring using ESP32.
- User-friendly mobile application built on React Native & Expo for seamless tracking.
- Syncing sensor data with Firebase.

## 🚀 Getting Started

### 1. ESP32 Firmware
Navigate to the `esp32-firmware` directory to learn more and flash the code:
- Ensure you have [PlatformIO](https://platformio.org/) installed in your IDE.
- Connect your ESP32, build, and upload the code.

### 2. Mobile Application
Navigate to the `mobile-app` directory to run the app:
- Install dependencies: `npm install`
- Start the development server: `npx expo start`
- Use the Expo Go app on your phone to scan the QR code and view the application.

## 📝 License 

This project is licensed under the MIT License.
