import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, getDocs, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export interface UserProfile {
  uid: string;
  email: string | null;
  name?: string;
  companyId: string;
  role?: 'admin' | 'staff' | 'viewer';
}

const CORE_TEAM_EMAILS = [
  'austin@catalyst.com.co',
  'garrett@catalyst.com.co',
  'clayton@catalyst.com.co',
  'josh@catalyst.com.co'
];

export const isCoreTeamEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return CORE_TEAM_EMAILS.includes(clean);
};

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
          const cleanEmail = (u.email || '').trim().toLowerCase();
          const isCore = isCoreTeamEmail(cleanEmail);
          const userRef = doc(db, 'users', u.uid);
          const snap = await getDoc(userRef);

          // Helper to ensure default_company (WOVN Studio) document exists & member is registered
          const ensureDefaultCompanyDoc = async () => {
            const defaultCompRef = doc(db, 'companies', 'default_company');
            const defaultCompSnap = await getDoc(defaultCompRef);
            if (!defaultCompSnap.exists()) {
              await setDoc(defaultCompRef, {
                name: 'WOVN Studio',
                adminUid: u.uid,
                joinCode: 'WOVN01',
                members: [u.uid],
                createdAt: new Date()
              });
            } else {
              await updateDoc(defaultCompRef, {
                members: arrayUnion(u.uid)
              });
            }
          };

          if (!snap.exists()) {
            let companyId = '';
            let role: 'admin' | 'staff' | 'viewer' = 'admin';

            if (isCore) {
              companyId = 'default_company';
              role = 'admin';
              await ensureDefaultCompanyDoc();
            } else {
              // Check if there is an existing pending invite for this user's email
              if (cleanEmail) {
                const pendingQuery = query(collection(db, 'companies'), where('pendingInvites', 'array-contains', cleanEmail));
                const pendingSnap = await getDocs(pendingQuery);
                if (!pendingSnap.empty) {
                  companyId = pendingSnap.docs[0].id;
                  role = 'viewer'; // Team invitees start as view-only until owner promotes to staff
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
                role = 'admin';
              }
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

            if (isCore) {
              // Core Catalyst team members always belong to default_company with admin full access
              if (data.companyId !== 'default_company' || data.role !== 'admin') {
                updatedData.companyId = 'default_company';
                updatedData.role = 'admin';
                needsUpdate = true;
                await ensureDefaultCompanyDoc();
              }
            } else {
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
                updatedData.role = 'admin';
                needsUpdate = true;
              }
              if (!data.role) {
                updatedData.role = 'admin';
                needsUpdate = true;
              }
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
