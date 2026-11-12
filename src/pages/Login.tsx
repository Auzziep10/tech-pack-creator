import React, { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, updateDoc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { sendInvitePasswordEmail } from '../services/dbService';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Layers, CheckCircle2 } from 'lucide-react';

export function Login() {
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode');
  const actionMode = searchParams.get('mode');
  const prefillEmail = searchParams.get('email') || '';
  const isInvitedRedirect = searchParams.get('invited') === '1';

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState(
    isInvitedRedirect
      ? 'Welcome! Sign in below with the password you just created to enter your team workspace.'
      : ''
  );
  const [isLoading, setIsLoading] = useState(false);

  // In-app password creation flow if Firebase Action URL points directly to /login
  const isResetFlow = actionMode === 'resetPassword' && Boolean(oobCode);
  const [verifyingCode, setVerifyingCode] = useState(isResetFlow);
  const navigate = useNavigate();

  useEffect(() => {
    if (prefillEmail && !email) {
      setEmail(prefillEmail);
    }
  }, [prefillEmail]);

  useEffect(() => {
    if (!isResetFlow || !oobCode) return;
    let cancelled = false;
    setVerifyingCode(true);
    verifyPasswordResetCode(auth, oobCode)
      .then((verifiedEmail) => {
        if (!cancelled) {
          setEmail(verifiedEmail);
          setError('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('This invite or password link has expired or already been used. Enter your email below and click "Forgot password?" for a fresh link.');
        }
      })
      .finally(() => {
        if (!cancelled) setVerifyingCode(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isResetFlow, oobCode]);

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) return;
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      const cred = await signInWithEmailAndPassword(auth, email, password);

      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
        await setDoc(
          doc(db, 'users', cred.user.uid),
          { name: name.trim(), invitePending: false },
          { merge: true }
        );
      } else {
        await setDoc(
          doc(db, 'users', cred.user.uid),
          { invitePending: false },
          { merge: true }
        );
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to set password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setInfoMessage('');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Enter your email address above first, then click "Forgot / Set password?".');
      return;
    }
    setIsLoading(true);
    try {
      await sendInvitePasswordEmail(cleanEmail);
      setInfoMessage(`Password setup link sent to ${cleanEmail}! Check your inbox (and spam folder).`);
    } catch (err: any) {
      setError(err.message || 'Failed to send password link.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setIsLoading(true);
    
    try {
      if (isLogin) {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        await setDoc(doc(db, 'users', cred.user.uid), { invitePending: false }, { merge: true }).catch(() => {});
      } else {
        const cleanEmail = email.trim().toLowerCase();
        try {
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
              role: 'staff',
              invitePending: false
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
        } catch (signupErr: any) {
          if (signupErr?.code === 'auth/email-already-in-use') {
            // Pre-invited teammates already have an auth account; try signing them in directly
            try {
              const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
              if (name.trim()) {
                await updateProfile(cred.user, { displayName: name.trim() });
                await setDoc(doc(db, 'users', cred.user.uid), { name: name.trim(), invitePending: false }, { merge: true });
              }
            } catch {
              setIsLogin(true);
              throw new Error(
                'An invited account already exists for this email. Sign in with the password from your invite link, or click "Forgot / Set password?" below to get a fresh email.'
              );
            }
          } else {
            throw signupErr;
          }
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
            {isResetFlow
              ? 'Create your password to join your team workspace.'
              : 'Log in to manage your garment technical specifications.'}
          </p>
        </div>

        <GlassCard className="p-8 shadow-sm border-gray-200">
          {isResetFlow ? (
            verifyingCode ? (
              <div className="py-8 text-center text-sm text-gray-500">Verifying your invitation link...</div>
            ) : (
              <form onSubmit={handleSetNewPassword} className="space-y-5">
                <Input
                  label="Email Address"
                  type="email"
                  value={email}
                  disabled
                />
                <Input
                  label="Your Full Name (Optional)"
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  label="Create Password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
                    {error}
                  </div>
                )}

                <div className="pt-2">
                  <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                    Save Password & Log In
                  </Button>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            )
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                {infoMessage && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-start gap-2">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600 mt-0.5" />
                    <span>{infoMessage}</span>
                  </div>
                )}

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
                <div>
                  <Input
                    label="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {isLogin && (
                    <div className="flex justify-end mt-1.5">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-xs text-gray-500 hover:text-gray-900 transition-colors font-medium"
                      >
                        Forgot / Set password?
                      </button>
                    </div>
                  )}
                </div>
                
                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm">
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
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                  }}
                  className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
