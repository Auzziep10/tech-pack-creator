import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDbBphUQ9uTG9A9Np5-9A5770Kk3EHYP40",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "tech-pack-creator-6c930.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "tech-pack-creator-6c930",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "tech-pack-creator-6c930.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "973526414669",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:973526414669:web:b25ad855525bed68603304"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
