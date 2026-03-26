import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { useAuth } from '../../contexts/AuthContext';
import { updateProfile, updateEmail, updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { User, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileSettingsModal({ isOpen, onClose }: Props) {
  const { user, profile } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (isOpen && user) {
      setName(user.displayName || profile?.name || '');
      setEmail(user.email || '');
      setPassword('');
      setMessage({ type: '', text: '' });
    }
  }, [isOpen, user, profile]);

  if (!isOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      let requiresReauth = false;
      const promises: Promise<any>[] = [];

      // Update Name
      if (name !== user.displayName) {
        promises.push(updateProfile(user, { displayName: name }));
        promises.push(updateDoc(doc(db, 'users', user.uid), { name }));
      }

      // Update Email
      if (email !== user.email && email.trim() !== '') {
        try {
          // Await sequentially to cleanly catch reauth error
          await updateEmail(user, email);
          promises.push(updateDoc(doc(db, 'users', user.uid), { email }));
        } catch (err: any) {
          if (err.code === 'auth/requires-recent-login') requiresReauth = true;
          else throw err;
        }
      }

      // Update Password
      if (password.trim() !== '') {
        try {
          await updatePassword(user, password);
        } catch (err: any) {
          if (err.code === 'auth/requires-recent-login') requiresReauth = true;
          else throw err;
        }
      }

      await Promise.all(promises);

      if (requiresReauth) {
        setMessage({ type: 'error', text: 'Updating email/password requires a recent login. Please log out, sign back in, and try again.' });
      } else {
        setMessage({ type: 'success', text: 'Profile updated successfully.' });
        setPassword('');
      }
    } catch (err: any) {
       console.error(err);
       setMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
       setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <User className="text-gray-900 bg-gray-100 p-1.5 rounded-lg" size={28} />
            Profile Settings
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {message.text && (
             <div className={`p-4 rounded-xl text-sm border font-medium ${message.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
               {message.text}
             </div>
          )}

          <div className="space-y-4">
             <Input 
                label="Full Name" 
                type="text"
                value={name} 
                onChange={e => setName(e.target.value)} 
             />
             <Input 
                label="Email Address" 
                type="email"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
             />
             <Input 
                label="New Password" 
                type="password"
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Leave blank to keep current password"
             />
          </div>
          
          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose} className="w-24 border-gray-200 hover:bg-gray-50">Cancel</Button>
            <Button type="submit" isLoading={isLoading} className="w-32 bg-black hover:bg-gray-800 text-white border-transparent">Save Changes</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
