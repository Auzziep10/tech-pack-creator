import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: "AIzaSyAe2v1vMRVqY6oBFEOPoUNZlq4p7ZZ_5zg",
  authDomain: "tech-pack-creator-6c930.firebaseapp.com",
  projectId: "tech-pack-creator-6c930",
  storageBucket: "tech-pack-creator-6c930.firebasestorage.app",
  messagingSenderId: "973526414669",
  appId: "1:973526414669:web:b25ad855525bed68603304"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
