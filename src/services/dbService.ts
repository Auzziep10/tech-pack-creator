import { collection, addDoc, updateDoc, doc, getDocs, getDoc, query, where, serverTimestamp, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

export interface TechPackData {
  id?: string;
  userId: string;
  name: string;
  imageUrl: string;
  updatedAt: any;
  createdAt?: any;
  techPack: any;
}

export const saveTechPack = async (userId: string, name: string, imageUrl: string, techPack: any, existingId?: string) => {
  if (existingId) {
    const packRef = doc(db, 'techPacks', existingId);
    await updateDoc(packRef, {
      name,
      imageUrl,
      techPack,
      updatedAt: serverTimestamp()
    });
    return existingId;
  } else {
    const docRef = await addDoc(collection(db, 'techPacks'), {
      userId,
      name,
      imageUrl,
      techPack,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  }
};

export const uploadGarmentImage = async (file: File, userId: string): Promise<string> => {
  const fileExtension = file.name.split('.').pop();
  const fileName = `techPacks/${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
  const storageRef = ref(storage, fileName);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};

export const uploadBase64Image = async (base64String: string, userId: string): Promise<string> => {
  const res = await fetch(base64String);
  const blob = await res.blob();
  const file = new File([blob], `techpack_asset_${Date.now()}.png`, { type: 'image/png' });
  return await uploadGarmentImage(file, userId);
};

export const getUserTechPacks = async (userId: string) => {
  // Note: orderBy requires a composite index in Firestore if combined with where().
  // If the index isn't created, Firebase will throw an error with a link to create it.
  const q = query(
    collection(db, 'techPacks'), 
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as TechPackData[];
};

export const getTechPack = async (id: string) => {
  const docRef = doc(db, 'techPacks', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as TechPackData;
  }
  return null;
};

// --- Mobile Scanning Features ---

export const createScanSession = async (userId: string) => {
  const docRef = await addDoc(collection(db, 'scanSessions'), {
    userId,
    status: 'pending',
    imageUrl: null,
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

export const updateScanSessionFront = async (sessionId: string, frontImageUrl: string) => {
  const sessionRef = doc(db, 'scanSessions', sessionId);
  await updateDoc(sessionRef, {
    status: 'front_scanned',
    frontImageUrl,
    updatedAt: serverTimestamp()
  });
};

export const completeScanSession = async (sessionId: string, backImageUrl: string) => {
  const sessionRef = doc(db, 'scanSessions', sessionId);
  await updateDoc(sessionRef, {
    status: 'completed',
    backImageUrl,
    updatedAt: serverTimestamp()
  });
};
