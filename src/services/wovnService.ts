import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, serverTimestamp, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

const wovnFirebaseConfig = {
  apiKey: "AIzaSyD0J9_ecnLBHzSawxjCDRFnttqUUHAzFv8",
  authDomain: "wovn-catalog.firebaseapp.com",
  projectId: "wovn-catalog",
  storageBucket: "wovn-catalog.firebasestorage.app",
  messagingSenderId: "1072086232494",
  appId: "1:1072086232494:web:b4f0c923770919b6152c3f"
};

// Use a named app instance to avoid collision with Tech Pack Creator's primary Firebase app
export const wovnApp = initializeApp(wovnFirebaseConfig, 'wovnApp');
export const wovnDb = getFirestore(wovnApp);

export const fetchWovnDecksAndItems = async (customerId: string) => {
  const numericId = parseInt(customerId, 10);
  if (isNaN(numericId)) return [];

  const q = query(collection(wovnDb, "decks"), where("customer_id", "==", numericId));
  const querySnapshot = await getDocs(q);
  const decksSnap = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));

  const results = await Promise.all(decksSnap.map(async (deckData) => {
      const itemsQ = query(collection(wovnDb, "deck_items"), where("deck_id", "==", Number(deckData.id)));
      const itemsSnap = await getDocs(itemsQ);

      const items = await Promise.all(itemsSnap.docs.map(async (itemDoc) => {
        const itemData: any = { id: itemDoc.id, ...itemDoc.data() };
        let garmentData: any = null;
        
        if (itemData.garment_id) {
          const garmentRef = doc(wovnDb, "garments", itemData.garment_id.toString());
          const garmentSnap = await getDoc(garmentRef);
          if (garmentSnap.exists()) {
            garmentData = garmentSnap.data();
          }
        }
        
        return {
          ...itemData,
          garment_name: itemData.custom_name || (garmentData ? garmentData.name : "Unknown Garment"),
          garment_description: itemData.custom_description || (garmentData ? garmentData.description : ""),
          garment_price: itemData.custom_price || (garmentData ? garmentData.price : 0),
          original_image: garmentData ? garmentData.image : null,
          category: garmentData ? garmentData.category : null,
          gender: garmentData ? garmentData.gender : null,
          type: garmentData ? garmentData.type : null,
          supplier_link: garmentData ? garmentData.supplier_link : null,
          fabric_details: garmentData ? garmentData.fabric_details : null,
          fabric_finish: garmentData ? garmentData.fabric_finish : null,
          care_instructions: garmentData ? garmentData.care_instructions : null,
          fit: garmentData ? garmentData.fit : null,
          fabric_weight_gsm: garmentData ? garmentData.fabric_weight_gsm : null,
          decoration_method: garmentData ? garmentData.decoration_method : null,
          sizes: garmentData ? garmentData.sizes : null,
          available_colors: garmentData ? garmentData.available_colors : null,
          wholesale_price: garmentData ? garmentData.wholesale_price : null,
          cost_price: garmentData ? garmentData.cost_price : null,
          msrp: garmentData ? garmentData.msrp : null,
          moq: garmentData ? garmentData.moq : null,
          turn_time: garmentData ? garmentData.turn_time : null,
          order_index: itemData.order_index || 0
        };
      }));

      items.sort((a, b) => a.order_index - b.order_index);
      return { ...deckData, items };
  }));

  return results;
};

// Queue Management natively in Tech Pack Creator
export const addWovnItemToCompanyQueue = async (companyId: string, userId: string, wovnItemData: any) => {
  const queueRef = doc(collection(db, 'garmentQueue'));
  await setDoc(queueRef, {
    companyId,
    userId,
    wovnItem: wovnItemData,
    status: 'pending',
    createdAt: serverTimestamp()
  });
  return queueRef.id;
};

export const getCompanyGarmentQueue = async (companyId: string) => {
  const q = query(collection(db, 'garmentQueue'), where('companyId', '==', companyId), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const deleteQueueItem = async (queueId: string) => {
  await deleteDoc(doc(db, 'garmentQueue', queueId));
};
