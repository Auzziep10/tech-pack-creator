import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export interface UserProfile {
  uid: string;
  email: string | null;
  name?: string;
  companyId: string;
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
      
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        const snap = await getDoc(userRef);
        
        if (!snap.exists()) {
          // Create initial profile where companyId is just their own UID
          const newProfile: UserProfile = {
            uid: u.uid,
            email: u.email,
            name: u.displayName || undefined,
            companyId: u.uid, // Default company
          };
          await setDoc(userRef, newProfile);
          setProfile(newProfile);
        } else {
          // Bulletproof patch preventing accidental legacy account team unbinding
          const data = snap.data() as UserProfile;
          if (!data.companyId) {
             data.companyId = u.uid;
             await setDoc(userRef, data, { merge: true });
          }
          setProfile(data);
        }

        // Listen for live updates (e.g., when they join a company)
        unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const liveData = docSnap.data() as UserProfile;
            if (!liveData.companyId) liveData.companyId = u.uid;
            setProfile(liveData);
          }
        });
      } else {
        setProfile(null);
      }
      setLoading(false);
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
