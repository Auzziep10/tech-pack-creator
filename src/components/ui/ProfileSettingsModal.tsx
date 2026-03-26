import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useAuth } from '../../contexts/AuthContext';
import { updateProfile, updateEmail, updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { User, Mail, Lock } from 'lucide-react';

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
    <Modal isOpen={isOpen} onClose={onClose} title="Profile Settings">
      <form onSubmit={handleSave} className="space-y-4">
        {message.text && (
           <div className={`p-4 rounded-xl text-sm border ${message.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
             {message.text}
           </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-400 ml-1 mb-1.5 block">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input 
                 type="text"
                 value={name} 
                 onChange={e => setName(e.target.value)} 
                 className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-white/30 focus:bg-white/10 transition-all font-medium"
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-400 ml-1 mb-1.5 block">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input 
                 type="email"
                 value={email} 
                 onChange={e => setEmail(e.target.value)} 
                 className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-white/30 focus:bg-white/10 transition-all font-medium"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-400 ml-1 mb-1.5 block">New Password <span className="text-gray-600 font-normal ml-1">(Optional)</span></label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input 
                 type="password"
                 value={password} 
                 onChange={e => setPassword(e.target.value)} 
                 placeholder="Leave blank to keep current password"
                 className="w-full bg-white/5 border border-white/10 text-white rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-white/30 focus:bg-white/10 transition-all font-medium placeholder:text-gray-600"
              />
            </div>
          </div>
        </div>
        
        <div className="pt-6 pb-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} className="bg-white/5 text-gray-300 hover:bg-white/10 border-white/10 w-24">Cancel</Button>
          <Button type="submit" isLoading={isLoading} className="w-32">Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}
