import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, updateDoc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Layers } from 'lucide-react';

export function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cleanEmail = email.trim().toLowerCase();
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(cred.user, { displayName: name.trim() });

        // Check if there is a pending invite for this email in any company
        const pendingCompaniesQuery = query(
          collection(db, 'companies'),
          where('pendingInvites', 'array-contains', cleanEmail)
        );
        const pendingSnap = await getDocs(pendingCompaniesQuery);

        if (!pendingSnap.empty) {
          // Join the inviting company
          const targetCompanyDoc = pendingSnap.docs[0];
          const targetCompanyId = targetCompanyDoc.id;

          await updateDoc(targetCompanyDoc.ref, {
            pendingInvites: arrayRemove(cleanEmail),
            members: arrayUnion(cred.user.uid)
          });

          await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            email: cleanEmail,
            name: name.trim(),
            companyId: targetCompanyId,
            role: 'staff'
          });
        } else {
          // Every new account creates their own company brand
          const companyDocRef = doc(collection(db, 'companies'));
          const newJoinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          const brandName = companyName.trim() || `${name.trim() || 'My'} Company`;

          await setDoc(companyDocRef, {
            name: brandName,
            adminUid: cred.user.uid,
            joinCode: newJoinCode,
            members: [cred.user.uid],
            createdAt: serverTimestamp()
          });

          await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            email: cleanEmail,
            name: name.trim(),
            companyId: companyDocRef.id,
            role: 'admin'
          });
        }
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center shadow-md mb-4">
            <Layers className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif font-bold tracking-tight text-gray-900">TechPack Generator</h1>
          <p className="text-gray-500 mt-2 text-center">
            Log in to manage your garment technical specifications.
          </p>
        </div>

        <GlassCard className="p-8 shadow-sm border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <>
                <Input
                  label="Full Name"
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  label="Company / Brand Name"
                  type="text"
                  placeholder="e.g. Acme Apparel, Studios, etc."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </>
            )}
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}
            
            <div className="pt-2">
              <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
