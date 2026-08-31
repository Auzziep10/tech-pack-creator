import { collection, addDoc, updateDoc, deleteDoc, writeBatch, doc, getDocs, getDoc, query, where, serverTimestamp, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

export interface FolderData {
  id?: string;
  name: string;
  companyId: string;
  userId: string;
  createdAt?: any;
}

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
  folderId?: string | null;
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

  const stripUndefined = (obj: any): any => {
    if (obj === undefined) return null;
    if (Array.isArray(obj)) return obj.map(stripUndefined);
    if (obj !== null && typeof obj === 'object') {
      const result: any = {};
      for (const key in obj) {
        if (obj[key] !== undefined) {
          result[key] = stripUndefined(obj[key]);
        }
      }
      return result;
    }
    return obj;
  };

  const payload = stripUndefined({
    companyId: companyId || userId,
    name: name || 'Untitled',
    imageUrl: imageUrl || '',
    techPack: techPack || {},
    activityLog: updatedLog,
    isTeamEditable
  });

  if (existingId) {
    const packRef = doc(db, 'techPacks', existingId);
    await updateDoc(packRef, {
      ...payload,
      updatedAt: serverTimestamp()
    });
    return existingId;
  } else {
    const docRef = await addDoc(collection(db, 'techPacks'), {
      ...payload,
      userId,
      creatorEmail,
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
  let ext = 'png';
  if (blob.type === 'image/svg+xml') ext = 'svg';
  if (blob.type === 'image/jpeg') ext = 'jpg';
  const file = new File([blob], `techpack_asset_${Date.now()}.${ext}`, { type: blob.type });
  return await uploadGarmentImage(file, userId);
};

export const getUserAndCompanyTechPacks = async (userId: string, companyId: string) => {
  const q = query(collection(db, 'techPacks'));
  const snap = await getDocs(q);
  const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TechPackData[];
  return results.sort((a, b) => {
    const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
    const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
    return timeB - timeA;
  });
};

export const getAllUsers = async (): Promise<any[]> => {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(doc => doc.data());
};

export const updateUserRole = async (uid: string, role: 'admin' | 'staff') => {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, { role });
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

// --- Dashboard Folder Features ---

export const getCompanyFolders = async (companyId: string): Promise<FolderData[]> => {
  const q = query(collection(db, 'folders'), where('companyId', '==', companyId));
  const snap = await getDocs(q);
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() })) as FolderData[];
  return results.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};

export const createFolder = async (userId: string, companyId: string, name: string): Promise<string> => {
  const docRef = await addDoc(collection(db, 'folders'), {
    name: name.trim(),
    companyId,
    userId,
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

export const updateFolder = async (folderId: string, name: string): Promise<void> => {
  const folderRef = doc(db, 'folders', folderId);
  await updateDoc(folderRef, {
    name: name.trim()
  });
};

export const deleteFolder = async (folderId: string): Promise<void> => {
  await deleteDoc(doc(db, 'folders', folderId));
  
  // Unassign tech packs belonging to this folder
  const q = query(collection(db, 'techPacks'), where('folderId', '==', folderId));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const batch = writeBatch(db);
    snap.docs.forEach(d => {
      batch.update(d.ref, { folderId: null });
    });
    await batch.commit();
  }
};

export const updateTechPackFolder = async (packId: string, folderId: string | null): Promise<void> => {
  const packRef = doc(db, 'techPacks', packId);
  await updateDoc(packRef, {
    folderId: folderId || null,
    updatedAt: serverTimestamp()
  });
};

export const moveTechPacksToFolder = async (packIds: string[], folderId: string | null): Promise<void> => {
  if (packIds.length === 0) return;
  const batch = writeBatch(db);
  packIds.forEach(id => {
    const ref = doc(db, 'techPacks', id);
    batch.update(ref, {
      folderId: folderId || null,
      updatedAt: serverTimestamp()
    });
  });
  await batch.commit();
};
