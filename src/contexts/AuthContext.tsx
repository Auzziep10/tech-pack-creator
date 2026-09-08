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
            // Find if there are admins
            const usersRef = collection(db, 'users');
            const adminsQuery = query(usersRef, where('role', '==', 'admin'));
            const adminsSnap = await getDocs(adminsQuery);
            const role = adminsSnap.empty ? 'admin' : 'staff';

            // Create initial profile where companyId is 'default_company'
            const newProfile: UserProfile = {
              uid: u.uid,
              email: u.email,
              name: u.displayName || undefined,
              companyId: 'default_company',
              role: role
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          } else {
            // Migrate legacy user profile
            const data = snap.data() as UserProfile;
            let needsUpdate = false;
            const updatedData = { ...data };

            if (data.companyId !== 'default_company') {
               updatedData.companyId = 'default_company';
               needsUpdate = true;
            }

            if (!data.role) {
               const usersRef = collection(db, 'users');
               const adminsQuery = query(usersRef, where('role', '==', 'admin'));
               const adminsSnap = await getDocs(adminsQuery);
               updatedData.role = adminsSnap.empty ? 'admin' : 'staff';
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
              const liveData = docSnap.data() as UserProfile;
              if (liveData.companyId !== 'default_company') {
                liveData.companyId = 'default_company';
              }
              setProfile(liveData);
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
