import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyDYzrRdKWXAfo7JGpQpZb58rX_bVxAVV_8",
  authDomain: "yetimhane-kundakcisi.firebaseapp.com",
  databaseURL: "https://yetimhane-kundakcisi-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "yetimhane-kundakcisi",
  storageBucket: "yetimhane-kundakcisi.firebasestorage.app",
  messagingSenderId: "85351609741",
  appId: "1:85351609741:web:4d24e1899d000c7fc1f9c4",
  measurementId: "G-Y5DR6T70E0"
};

const app = initializeApp(firebaseConfig);

export const database = getDatabase(app);
export const analytics = getAnalytics(app);

export default app; 