import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export interface UserProfile {
  uid: string;
  email: string | null;
  name?: string;
  companyId: string;
  role?: 'admin' | 'staff';
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      try {
        if (u && !u.isAnonymous) {
          const userRef = doc(db, 'users', u.uid);
          const snap = await getDoc(userRef);
          
          if (!snap.exists()) {
            const cleanEmail = (u.email || '').trim().toLowerCase();
            let companyId = '';
            let role: 'admin' | 'staff' = 'admin';

            // Check if there is an existing pending invite for this user's email
            if (cleanEmail) {
              const pendingQuery = query(collection(db, 'companies'), where('pendingInvites', 'array-contains', cleanEmail));
              const pendingSnap = await getDocs(pendingQuery);
              if (!pendingSnap.empty) {
                companyId = pendingSnap.docs[0].id;
                role = 'staff';
              }
            }

            // Otherwise, create a unique company for them
            if (!companyId) {
              const companyDocRef = doc(collection(db, 'companies'));
              const newJoinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
              companyId = companyDocRef.id;
              await setDoc(companyDocRef, {
                name: `${u.displayName || 'My'} Company`,
                adminUid: u.uid,
                joinCode: newJoinCode,
                members: [u.uid],
                createdAt: new Date()
              });
            }

            const newProfile: UserProfile = {
              uid: u.uid,
              email: u.email,
              name: u.displayName || undefined,
              companyId: companyId,
              role: role
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          } else {
            const data = snap.data() as UserProfile;
            let needsUpdate = false;
            const updatedData = { ...data };

            if (!data.companyId) {
              const companyDocRef = doc(collection(db, 'companies'));
              const newJoinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
              await setDoc(companyDocRef, {
                name: `${u.displayName || 'My'} Company`,
                adminUid: u.uid,
                joinCode: newJoinCode,
                members: [u.uid],
                createdAt: new Date()
              });
              updatedData.companyId = companyDocRef.id;
              needsUpdate = true;
            }

            if (!data.role) {
              updatedData.role = 'admin';
              needsUpdate = true;
            }

            if (needsUpdate) {
              await setDoc(userRef, updatedData, { merge: true });
            }
            setProfile(updatedData);
          }

          // Listen for live updates
          unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
              setProfile(docSnap.data() as UserProfile);
            }
          });
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
