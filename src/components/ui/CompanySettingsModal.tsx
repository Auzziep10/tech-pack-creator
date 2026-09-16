import React, { useState, useEffect } from 'react';
import { X, Copy, CheckCircle2, Building, Users, UserPlus, LogIn, AlertCircle } from 'lucide-react';
import { useAuth, UserProfile } from '../../contexts/AuthContext';
import { db } from '../../services/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { fetchAllWovnCustomers } from '../../services/wovnService';
import { getCompanyUsers, updateUserRole, joinCompanyByCode, addTeamMemberByEmail } from '../../services/dbService';
import { Button } from './Button';
import { Input } from './Input';

interface CompanySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CompanySettingsModal({ isOpen, onClose }: CompanySettingsModalProps) {
  const { profile, user } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Company Profile Editing
  const [companyName, setCompanyName] = useState('');
  const [wovnCustomerIds, setWovnCustomerIds] = useState<string[]>([]);
  const [availableWovnCustomers, setAvailableWovnCustomers] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Team Management State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Add Member by Email State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteError, setInviteError] = useState('');

  // Join Existing Team State
  const [inputJoinCode, setInputJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState('');
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (isOpen && profile?.companyId) {
      const loadCompanySettings = async () => {
        const companyRef = doc(db, 'companies', profile.companyId);
        const snap = await getDoc(companyRef);
        
        if (snap.exists()) {
          const data = snap.data();
          setJoinCode(data.joinCode || '');
          setCompanyName(data.name || '');
          
          let ids: string[] = data.wovnCustomerIds || [];
          if (data.wovnCustomerId && !ids.includes(data.wovnCustomerId)) {
            ids.push(data.wovnCustomerId);
          }
          setWovnCustomerIds(ids);
        } else {
          const newJoinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          const defaultName = `${user?.displayName || 'My'} Company`;
          await setDoc(companyRef, {
            name: defaultName,
            adminUid: profile.uid,
            joinCode: newJoinCode,
            members: [profile.uid],
            createdAt: new Date()
          });
          setJoinCode(newJoinCode);
          setCompanyName(defaultName);
        }
      };
      
      const fetchWovnOptions = async () => {
        try {
          const customers = await fetchAllWovnCustomers();
          setAvailableWovnCustomers(customers);
        } catch (e) {
          console.error(e);
        }
      };

      const loadUsers = async () => {
        setUsersLoading(true);
        try {
          const companyMembers = await getCompanyUsers(profile.companyId);
          setUsers(companyMembers);
        } catch (e) {
          console.error("Failed to load users:", e);
        } finally {
          setUsersLoading(false);
        }
      };

      loadCompanySettings();
      fetchWovnOptions();
      loadUsers();
    }
  }, [isOpen, profile, user]);

  if (!isOpen || !profile) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveCompanyProfile = async () => {
    if (!profile.companyId) return;
    setIsSaving(true);
    try {
      const companyRef = doc(db, 'companies', profile.companyId);
      await updateDoc(companyRef, {
        name: companyName.trim(),
        wovnCustomerIds: wovnCustomerIds
      });
      alert('Company settings saved successfully.');
    } catch (e: any) {
      console.error(e);
      alert('Error saving company profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: 'admin' | 'staff') => {
    try {
      await updateUserRole(uid, newRole);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: newRole } : u));
    } catch (e) {
      console.error("Failed to update role:", e);
      alert("Failed to update team member's role.");
    }
  };

  const handleAddMemberByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !profile.companyId) return;
    setInviteLoading(true);
    setInviteError('');
    setInviteSuccess('');
    try {
      const res = await addTeamMemberByEmail(profile.companyId, inviteEmail.trim());
      setInviteSuccess(res.message);
      setInviteEmail('');
      const companyMembers = await getCompanyUsers(profile.companyId);
      setUsers(companyMembers);
    } catch (err: any) {
      setInviteError(err.message || 'Failed to add member.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputJoinCode.trim() || !user) return;
    setJoinLoading(true);
    setJoinError('');
    setJoinSuccess('');

    try {
      const res = await joinCompanyByCode(
        inputJoinCode.trim(),
        profile.uid,
        user.email || profile.email || '',
        user.displayName || profile.name || '',
        profile.companyId
      );

      if (!res.success) {
        setJoinError(res.error || 'Failed to join team.');
      } else {
        setJoinSuccess(`Success! You joined ${res.companyName}. Combining your dashboards...`);
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      }
    } catch (err: any) {
      setJoinError(err.message || 'Error joining team.');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <Building className="text-blue-600" size={20} />
            Company & Team Settings
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </header>

        <div className="p-6 space-y-8 overflow-y-auto max-h-[80vh]">
          {/* Company Profile Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Company Profile</h3>
              <p className="text-sm text-gray-500 mt-1">Configure your company identity and integrations.</p>
            </div>
            
            <Input 
              label="Company Name" 
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Apparel"
              disabled={profile.role !== 'admin'}
            />
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">WOVN Catalog Connection (Customers)</label>
              <div className="border border-gray-200 rounded-lg max-h-36 overflow-y-auto bg-gray-50/50">
                {availableWovnCustomers.length === 0 ? (
                  <div className="p-3 text-xs text-gray-400">Loading customers...</div>
                ) : (
                  availableWovnCustomers.map(c => {
                    const isSelected = wovnCustomerIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-3 p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={(e) => {
                             if (e.target.checked) setWovnCustomerIds(prev => [...prev, c.id]);
                             else setWovnCustomerIds(prev => prev.filter(id => id !== c.id));
                          }}
                          disabled={profile.role !== 'admin'}
                          className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black disabled:opacity-50"
                        />
                        <div className="flex flex-col">
                           <span className="text-sm font-semibold text-gray-900 leading-tight">{c.company || c.name || `Customer #${c.id}`}</span>
                           <span className="text-[10px] text-gray-500 font-mono">ID: {c.id}</span>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
            
            {profile.role === 'admin' ? (
              <Button onClick={handleSaveCompanyProfile} disabled={isSaving} className="w-full bg-black text-white hover:bg-gray-800 mt-2">
                {isSaving ? 'Saving...' : 'Save Profile Settings'}
              </Button>
            ) : (
              <p className="text-xs text-gray-400 mt-1 text-center font-medium">Only Administrators can modify company profile settings.</p>
            )}
          </div>

          <div className="w-full h-px bg-gray-100" />

          {/* Team Members & Roles Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <Users size={16} /> Team Members ({users.length})
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {profile.role === 'admin' 
                  ? "Manage members and roles in your company workspace." 
                  : "View members in your company workspace."}
              </p>
            </div>

            {usersLoading ? (
              <div className="text-sm text-gray-400 py-2">Loading team members...</div>
            ) : (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 bg-gray-50/50 max-h-52 overflow-y-auto">
                {users.map(u => (
                  <div key={u.uid} className="p-3 flex items-center justify-between">
                    <div className="flex flex-col min-w-0 mr-2">
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {u.name || 'Unnamed Member'} {u.uid === user?.uid && <span className="text-xs text-blue-600 font-normal">(You)</span>}
                      </span>
                      <span className="text-xs text-gray-500 truncate font-mono">{u.email}</span>
                    </div>
                    
                    <div>
                      {profile.role === 'admin' && u.uid !== user?.uid ? (
                        <select
                          value={u.role || 'staff'}
                          onChange={(e) => handleRoleChange(u.uid, e.target.value as 'admin' | 'staff')}
                          className="bg-white border border-gray-200 rounded-lg text-xs font-semibold px-2 py-1 focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                        >
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                          (u.role || 'staff') === 'admin' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {u.role || 'staff'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Teammate by Email (Admin Only) */}
            {profile.role === 'admin' && (
              <form onSubmit={handleAddMemberByEmail} className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <UserPlus size={14} /> Add Teammate by Email
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black focus:bg-white"
                  />
                  <Button type="submit" disabled={inviteLoading || !inviteEmail.trim()} className="px-4 py-2 shrink-0 text-xs">
                    {inviteLoading ? 'Adding...' : 'Add to Team'}
                  </Button>
                </div>
                {inviteSuccess && (
                  <p className="text-xs text-green-700 bg-green-50 p-2 rounded-md flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="shrink-0" /> {inviteSuccess}
                  </p>
                )}
                {inviteError && (
                  <p className="text-xs text-red-600 bg-red-50 p-2 rounded-md flex items-center gap-1.5">
                    <AlertCircle size={14} className="shrink-0" /> {inviteError}
                  </p>
                )}
              </form>
            )}
          </div>

          <div className="w-full h-px bg-gray-100" />

          {/* Share Join Code Section */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Your Team Join Code</h3>
              <p className="text-sm text-gray-500 mt-1">Share this code with teammates so they can join your workspace and combine tech packs.</p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 font-mono font-bold tracking-widest text-lg text-center select-all text-gray-800">
                {joinCode || '...'}
              </div>
              <Button onClick={handleCopy} variant="secondary" className="px-4 py-3 shrink-0 rounded-lg" title="Copy code">
                {copied ? <CheckCircle2 size={20} className="text-green-600" /> : <Copy size={20} />}
              </Button>
            </div>
          </div>

          <div className="w-full h-px bg-gray-100" />

          {/* Join Another Team Section */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <LogIn size={16} /> Join Existing Team
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Have a Join Code from another company? Enter it here to merge your tech packs and folders into their team dashboard.
              </p>
            </div>

            <form onSubmit={handleJoinTeam} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={10}
                  value={inputJoinCode}
                  onChange={(e) => setInputJoinCode(e.target.value.toUpperCase())}
                  placeholder="ENTER 6-DIGIT CODE"
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg font-mono font-bold text-center tracking-widest uppercase text-sm focus:outline-none focus:ring-1 focus:ring-black focus:bg-white"
                />
                <Button type="submit" disabled={joinLoading || !inputJoinCode.trim()} className="px-5 py-2.5 shrink-0">
                  {joinLoading ? 'Joining...' : 'Join Team'}
                </Button>
              </div>

              {joinSuccess && (
                <p className="text-xs text-green-700 bg-green-50 p-2.5 rounded-md flex items-center gap-1.5 font-medium">
                  <CheckCircle2 size={16} className="shrink-0" /> {joinSuccess}
                </p>
              )}
              {joinError && (
                <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-md flex items-center gap-1.5 font-medium">
                  <AlertCircle size={16} className="shrink-0" /> {joinError}
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

