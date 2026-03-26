import React, { useState, useEffect } from 'react';
import { X, Copy, CheckCircle2, Building, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, setDoc } from 'firebase/firestore';
import { Button } from './Button';
import { Input } from './Input';

interface CompanySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CompanySettingsModal({ isOpen, onClose }: CompanySettingsModalProps) {
  const { profile, user } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && profile?.companyId) {
      // Fetch the company's join code securely
      const loadCompanySettings = async () => {
        const companyRef = doc(db, 'companies', profile.companyId);
        const snap = await getDoc(companyRef);
        
        if (snap.exists()) {
          setJoinCode(snap.data().joinCode || '');
        } else {
          // Backward compatibility: If the user has a profile but no company document exists, create it
          const newJoinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          await setDoc(companyRef, {
            name: `${user?.displayName || 'My'} Company`,
            adminUid: profile.uid,
            joinCode: newJoinCode,
            createdAt: new Date()
          });
          setJoinCode(newJoinCode);
        }
      };
      
      loadCompanySettings();
    }
  }, [isOpen, profile, user]);

  if (!isOpen || !profile) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async () => {
    if (!inputCode.trim()) return;
    setLoading(true);
    setError('');

    try {
      const q = query(collection(db, 'companies'), where('joinCode', '==', inputCode.trim().toUpperCase()));
      const snap = await getDocs(q);

      if (snap.empty) {
        setError('Invalid Join Code. Please verify with your team.');
      } else {
        const companyDoc = snap.docs[0];
        const newCompanyId = companyDoc.id;

        // Update the user's profile to the new secure companyId
        const userRef = doc(db, 'users', profile.uid);
        await updateDoc(userRef, { companyId: newCompanyId });
        
        alert("Success! You've joined the team.");
        window.location.reload(); // Refresh the app to flush caching
      }
    } catch (e: any) {
      console.error(e);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <Building className="text-blue-600" size={20} />
            Company Settings
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </header>

        <div className="p-6 space-y-8">
          {/* Invite Team Section */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Invite Your Team</h3>
              <p className="text-sm text-gray-500 mt-1">Share this secure join code with colleagues so they can contribute to your Tech Packs.</p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-mono font-bold tracking-widest text-lg text-center select-all">
                {joinCode || '...'}
              </div>
              <Button onClick={handleCopy} variant="secondary" className="px-4 py-3 shrink-0 rounded-lg">
                {copied ? <CheckCircle2 size={20} className="text-green-600" /> : <Copy size={20} />}
              </Button>
            </div>
          </div>

          <div className="w-full h-px bg-gray-100" />

          {/* Join Another Company Section */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                  <Users size={16} /> Join a Team
                </h3>
                {profile.companyId !== profile.uid && (
                  <Button 
                    variant="secondary" 
                    onClick={async () => {
                      const userRef = doc(db, 'users', profile.uid);
                      await updateDoc(userRef, { companyId: profile.uid });
                      alert("Successfully disconnected from team.");
                      window.location.reload();
                    }}
                    className="bg-red-50 text-red-600 hover:bg-red-100 border-transparent hover:border-red-200 shrink-0 text-xs px-3 py-1.5 h-auto transition-colors"
                  >
                    Disconnect
                  </Button>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">Have an invite code from a colleague? Enter it below to seamlessly switch your active workplace.</p>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <Input 
                  placeholder="Enter 6-digit code..." 
                  value={inputCode} 
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
              </div>
              <Button onClick={handleJoin} disabled={loading || inputCode.length < 5} className="bg-black hover:bg-gray-800 text-white rounded-lg px-6 shrink-0">
                {loading ? 'Joining...' : 'Join'}
              </Button>
            </div>
            {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
