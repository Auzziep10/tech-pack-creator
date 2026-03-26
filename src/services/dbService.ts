import { collection, addDoc, updateDoc, doc, getDocs, getDoc, query, where, serverTimestamp, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

export interface TechPackData {
  id?: string;
  userId: string;
  companyId?: string;
  creatorEmail?: string;
  name: string;
  imageUrl: string;
  updatedAt: any;
  createdAt?: any;
  techPack: any;
  activityLog?: any[];
  isTeamEditable?: boolean;
}

export const saveTechPack = async (
  userId: string, 
  companyId: string, 
  name: string, 
  imageUrl: string, 
  techPack: any, 
  creatorEmail: string,
  existingId?: string,
  existingLog?: any[],
  isTeamEditable: boolean = true
) => {
  let updatedLog = [...(existingLog || [])];
  
  if (!existingId) {
    updatedLog.unshift({
      timestamp: new Date().toISOString(),
      message: 'Created Tech Pack',
      user: creatorEmail
    });
  }

  if (existingId) {
    const packRef = doc(db, 'techPacks', existingId);
    await updateDoc(packRef, {
      companyId,
      name,
      imageUrl,
      techPack,
      updatedAt: serverTimestamp(),
      activityLog: updatedLog,
      isTeamEditable
    });
    return existingId;
  } else {
    const docRef = await addDoc(collection(db, 'techPacks'), {
      userId,
      companyId,
      creatorEmail,
      name,
      imageUrl,
      techPack,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      activityLog: updatedLog,
      isTeamEditable
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
  let ext = 'png';
  if (blob.type === 'image/svg+xml') ext = 'svg';
  if (blob.type === 'image/jpeg') ext = 'jpg';
  const file = new File([blob], `techpack_asset_${Date.now()}.${ext}`, { type: blob.type });
  return await uploadGarmentImage(file, userId);
};

export const getUserAndCompanyTechPacks = async (userId: string, companyId: string) => {
  if (userId === companyId) {
    const q = query(collection(db, 'techPacks'), where("companyId", "==", companyId));
    const snap = await getDocs(q);
    const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TechPackData[];
    return results.sort((a, b) => {
      const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
      const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
      return timeB - timeA;
    });
  }

  const qCompany = query(collection(db, 'techPacks'), where("companyId", "==", companyId));
  const qUser = query(collection(db, 'techPacks'), where("userId", "==", userId));

  const [snapCompany, snapUser] = await Promise.all([getDocs(qCompany), getDocs(qUser)]);
  
  const map = new Map<string, TechPackData>();
  snapCompany.docs.forEach(doc => map.set(doc.id, { id: doc.id, ...doc.data() } as TechPackData));
  snapUser.docs.forEach(doc => map.set(doc.id, { id: doc.id, ...doc.data() } as TechPackData));
  
  const results = Array.from(map.values());
  return results.sort((a, b) => {
    const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
    const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
    return timeB - timeA;
  });
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
