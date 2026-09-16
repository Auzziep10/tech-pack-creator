import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Copy, 
  CheckCircle2, 
  Building, 
  Users, 
  UserPlus, 
  LogIn, 
  AlertCircle, 
  Search, 
  ShieldCheck, 
  Key, 
  Check, 
  Loader2,
  Briefcase,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
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

type SettingsTab = 'profile' | 'team' | 'access';

export function CompanySettingsModal({ isOpen, onClose }: CompanySettingsModalProps) {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Company Profile Editing
  const [companyName, setCompanyName] = useState('');
  const [wovnCustomerIds, setWovnCustomerIds] = useState<string[]>([]);
  const [availableWovnCustomers, setAvailableWovnCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && profile?.companyId) {
      const loadCompanySettings = async () => {
        try {
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
        } catch (e) {
          console.error("Failed to load company settings:", e);
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
    setSaveSuccess(false);
    try {
      const companyRef = doc(db, 'companies', profile.companyId);
      await updateDoc(companyRef, {
        name: companyName.trim(),
        wovnCustomerIds: wovnCustomerIds
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      console.error(e);
      alert('Error saving company profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: 'admin' | 'staff' | 'viewer') => {
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

  const filteredCustomers = availableWovnCustomers.filter(c => {
    const q = customerSearch.toLowerCase();
    const name = (c.company || c.name || '').toLowerCase();
    const id = (c.id || '').toLowerCase();
    return name.includes(q) || id.includes(q);
  });

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.substring(0, 2).toUpperCase();
    }
    if (email) return email.substring(0, 2).toUpperCase();
    return 'AU';
  };

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 lg:p-8">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          className="relative w-full max-w-5xl h-[92vh] md:h-[84vh] max-h-[820px] bg-white rounded-2xl md:rounded-3xl shadow-2xl border border-gray-200/80 flex flex-col overflow-hidden z-10"
        >
          {/* Header */}
          <header className="px-5 sm:px-7 py-4 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shadow-xs">
                <Building size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-serif font-bold text-gray-950 tracking-tight">
                    Workspace & Team Settings
                  </h2>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    profile.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {profile.role || 'staff'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 hidden sm:block">
                  Manage company profile, WOVN catalog integrations, team roles, and workspace access.
                </p>
              </div>
            </div>

            <button 
              onClick={onClose} 
              className="p-2 text-gray-400 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100"
              title="Close (Esc)"
            >
              <X size={20} />
            </button>
          </header>

          {/* Main Layout */}
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
            {/* Navigation Tabs (Desktop Rail / Mobile Horizontal Pills) */}
            <nav className="shrink-0 bg-gray-50/80 border-b md:border-b-0 md:border-r border-gray-100 p-2 sm:p-3 md:p-4 flex md:flex-col justify-between md:w-64 gap-1.5 overflow-x-auto no-scrollbar">
              <div className="flex md:flex-col gap-1.5 w-full">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 md:w-full text-left ${
                    activeTab === 'profile'
                      ? 'bg-white text-gray-950 shadow-xs border border-gray-200/80 font-bold'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-transparent'
                  }`}
                >
                  <Building size={18} className={activeTab === 'profile' ? 'text-black' : 'text-gray-400'} />
                  <div className="hidden sm:flex flex-col">
                    <span>Company Profile</span>
                    <span className="text-[10px] text-gray-400 font-normal">Identity & WOVN</span>
                  </div>
                  <span className="sm:hidden">Profile</span>
                </button>

                <button
                  onClick={() => setActiveTab('team')}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 md:w-full text-left justify-between ${
                    activeTab === 'team'
                      ? 'bg-white text-gray-950 shadow-xs border border-gray-200/80 font-bold'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users size={18} className={activeTab === 'team' ? 'text-black' : 'text-gray-400'} />
                    <div className="hidden sm:flex flex-col">
                      <span>Team Members</span>
                      <span className="text-[10px] text-gray-400 font-normal">Roles & permissions</span>
                    </div>
                    <span className="sm:hidden">Team</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700 ml-1">
                    {users.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('access')}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 md:w-full text-left ${
                    activeTab === 'access'
                      ? 'bg-white text-gray-950 shadow-xs border border-gray-200/80 font-bold'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-transparent'
                  }`}
                >
                  <Key size={18} className={activeTab === 'access' ? 'text-black' : 'text-gray-400'} />
                  <div className="hidden sm:flex flex-col">
                    <span>Join & Invite</span>
                    <span className="text-[10px] text-gray-400 font-normal">Workspace codes</span>
                  </div>
                  <span className="sm:hidden">Access</span>
                </button>
              </div>

              {/* Bottom Workspace Summary (Desktop Rail) */}
              <div className="hidden md:block border-t border-gray-200/60 pt-4 mt-auto">
                <div className="bg-white p-3 rounded-2xl border border-gray-200/80 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">WORKSPACE</span>
                    <span className="text-[10px] font-mono font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                      {joinCode || '------'}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-gray-900 truncate">
                    {companyName || 'My Company'}
                  </div>
                  <div className="text-[11px] text-gray-500 flex items-center justify-between">
                    <span>{users.length} member{users.length !== 1 ? 's' : ''}</span>
                    <button 
                      onClick={handleCopy} 
                      className="text-blue-600 hover:text-blue-800 font-medium text-[10px] flex items-center gap-1"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy Code'}
                    </button>
                  </div>
                </div>
              </div>
            </nav>

            {/* Content Area */}
            <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto bg-white">
              {/* TAB 1: Company Profile & WOVN Catalog */}
              {activeTab === 'profile' && (
                <div className="max-w-2xl space-y-6 animate-in fade-in duration-200">
                  <div>
                    <h3 className="text-base sm:text-lg font-serif font-bold text-gray-900">
                      Company Profile & Integrations
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                      Configure your company name and connect WOVN customer catalogs to sync products seamlessly.
                    </p>
                  </div>

                  {/* Company Name Form */}
                  <div className="bg-gray-50/60 border border-gray-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-700">
                        Company Name
                      </label>
                      {profile.role !== 'admin' && (
                        <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                          <ShieldCheck size={12} /> Read-only (Admin only)
                        </span>
                      )}
                    </div>
                    <Input 
                      value={companyName}
                      onChange={e => setCompanyName(e.target.value)}
                      placeholder="e.g. WOVN Studio"
                      disabled={profile.role !== 'admin'}
                      className="bg-white"
                    />
                  </div>

                  {/* WOVN Catalog Integration */}
                  <div className="bg-gray-50/60 border border-gray-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                            WOVN Catalog Connection (Customers)
                          </h4>
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {wovnCustomerIds.length} connected
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Select which customer product lines should synchronize with this tech pack creator.
                        </p>
                      </div>

                      {profile.role === 'admin' && availableWovnCustomers.length > 0 && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setWovnCustomerIds(availableWovnCustomers.map(c => c.id))}
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            Select All
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            type="button"
                            onClick={() => setWovnCustomerIds([])}
                            className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 hover:underline"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Search filter for customers */}
                    {availableWovnCustomers.length > 3 && (
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={customerSearch}
                          onChange={e => setCustomerSearch(e.target.value)}
                          placeholder="Search customers by name or ID..."
                          className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>
                    )}

                    {/* Customer Checklist */}
                    <div className="border border-gray-200 rounded-xl max-h-60 overflow-y-auto bg-white divide-y divide-gray-100 shadow-2xs">
                      {availableWovnCustomers.length === 0 ? (
                        <div className="p-6 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                          <Loader2 size={16} className="animate-spin" /> Loading WOVN customers...
                        </div>
                      ) : filteredCustomers.length === 0 ? (
                        <div className="p-6 text-center text-xs text-gray-400">
                          No matching customers found for "{customerSearch}".
                        </div>
                      ) : (
                        filteredCustomers.map(c => {
                          const isSelected = wovnCustomerIds.includes(c.id);
                          return (
                            <label 
                              key={c.id} 
                              className={`flex items-center gap-3 p-3.5 hover:bg-gray-50 cursor-pointer transition-colors ${
                                isSelected ? 'bg-blue-50/40' : ''
                              }`}
                            >
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
                              <div className="flex-1 flex items-center justify-between min-w-0">
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                                    {c.company || c.name || `Customer #${c.id}`}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-mono">
                                    ID: {c.id}
                                  </span>
                                </div>
                                {isSelected && (
                                  <span className="text-[10px] font-bold text-blue-600 bg-blue-100/70 px-2 py-0.5 rounded-full shrink-0">
                                    Connected
                                  </span>
                                )}
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Save Button */}
                  {profile.role === 'admin' ? (
                    <div className="flex items-center gap-3 pt-2">
                      <Button 
                        onClick={handleSaveCompanyProfile} 
                        disabled={isSaving} 
                        isLoading={isSaving}
                        className="bg-black text-white hover:bg-gray-800 px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl shadow-xs"
                      >
                        {isSaving ? 'Saving...' : 'Save Profile Settings'}
                      </Button>
                      {saveSuccess && (
                        <span className="text-xs text-emerald-600 font-bold flex items-center gap-1.5 animate-in fade-in">
                          <CheckCircle2 size={16} /> Changes saved successfully!
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 pt-2 font-medium flex items-center gap-1.5">
                      <ShieldCheck size={14} /> Only Administrators can modify company profile and catalog settings.
                    </p>
                  )}
                </div>
              )}

              {/* TAB 2: Team Members & Roles */}
              {activeTab === 'team' && (
                <div className="max-w-3xl space-y-6 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base sm:text-lg font-serif font-bold text-gray-900 flex items-center gap-2">
                        Team Members & Permissions
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                        Manage user roles and invite colleagues to collaborate on tech packs.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1 rounded-full shrink-0 w-fit">
                      {users.length} Active Member{users.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Add Teammate by Email (Admin Only) */}
                  {profile.role === 'admin' && (
                    <div className="bg-gray-50/60 border border-gray-200/80 rounded-2xl p-4 sm:p-5">
                      <form onSubmit={handleAddMemberByEmail} className="space-y-3">
                        <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                          <UserPlus size={15} /> Add Teammate by Email
                        </label>
                        <p className="text-xs text-gray-500">
                          Invite a colleague directly. If they have an existing account, they will be merged into this workspace immediately.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="colleague@example.com"
                            className="flex-1 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-black"
                          />
                          <Button 
                            type="submit" 
                            disabled={inviteLoading || !inviteEmail.trim()} 
                            isLoading={inviteLoading}
                            className="bg-black text-white px-5 py-2 shrink-0 text-xs font-bold rounded-xl"
                          >
                            {inviteLoading ? 'Adding...' : 'Add to Team'}
                          </Button>
                        </div>
                        {inviteSuccess && (
                          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center gap-2 font-medium">
                            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" /> {inviteSuccess}
                          </div>
                        )}
                        {inviteError && (
                          <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-xl flex items-center gap-2 font-medium">
                            <AlertCircle size={15} className="shrink-0 text-red-500" /> {inviteError}
                          </div>
                        )}
                      </form>
                    </div>
                  )}

                  {/* Team Members List */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                      Current Workspace Members
                    </h4>

                    {usersLoading ? (
                      <div className="p-8 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                        <Loader2 size={16} className="animate-spin" /> Loading team members...
                      </div>
                    ) : (
                      <div className="border border-gray-200 rounded-2xl divide-y divide-gray-100 bg-white overflow-hidden shadow-2xs">
                        {users.map(u => {
                          const isSelf = u.uid === user?.uid;
                          const isAdmin = (u.role || 'staff') === 'admin';

                          return (
                            <div key={u.uid} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-gray-50/60 transition-colors">
                              {/* Member Info */}
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {getInitials(u.name, u.email)}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                                      {u.name || 'Unnamed Member'}
                                    </span>
                                    {isSelf && (
                                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[11px] sm:text-xs text-gray-500 truncate font-mono">
                                    {u.email}
                                  </span>
                                </div>
                              </div>

                              {/* Role Selector / Pill */}
                              <div className="shrink-0">
                                {profile.role === 'admin' && !isSelf ? (
                                  <select
                                    value={u.role || 'staff'}
                                    onChange={(e) => handleRoleChange(u.uid, e.target.value as 'admin' | 'staff' | 'viewer')}
                                    className="bg-white border border-gray-200 rounded-lg text-xs font-bold px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-black focus:border-black cursor-pointer shadow-2xs"
                                  >
                                    <option value="viewer">Viewer (View-Only)</option>
                                    <option value="staff">Staff (Read & Write)</option>
                                    <option value="admin">Admin (Full Control)</option>
                                  </select>
                                ) : (
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                                    isAdmin 
                                      ? 'bg-purple-100 text-purple-700' 
                                      : u.role === 'viewer'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {u.role === 'viewer' ? 'Viewer (Read-Only)' : u.role || 'staff'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Workspace & Join Codes */}
              {activeTab === 'access' && (
                <div className="max-w-2xl space-y-6 animate-in fade-in duration-200">
                  <div>
                    <h3 className="text-base sm:text-lg font-serif font-bold text-gray-900">
                      Workspace Access & Join Codes
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                      Share your workspace code with collaborators or enter a code to join another team.
                    </p>
                  </div>

                  {/* Share Your Join Code */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center">
                        <Key size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                          Your Team Join Code
                        </h4>
                        <p className="text-xs text-gray-500">
                          Anyone with this code can join your company workspace and access your tech packs.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3.5 font-mono font-black tracking-[0.25em] text-xl sm:text-2xl text-center select-all text-gray-900 shadow-2xs">
                        {joinCode || '------'}
                      </div>
                      <Button 
                        onClick={handleCopy} 
                        variant="secondary" 
                        className="px-5 py-3.5 shrink-0 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 shadow-2xs" 
                        title="Copy code to clipboard"
                      >
                        {copied ? (
                          <>
                            <CheckCircle2 size={16} className="text-emerald-600" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={16} />
                            <span>Copy</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Join Existing Team Section */}
                  <div className="bg-gray-50/60 border border-gray-200/80 rounded-2xl p-5 sm:p-6 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                        <LogIn size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                          Join Existing Team
                        </h4>
                        <p className="text-xs text-gray-500">
                          Have a Join Code from another company? Enter it below to combine your tech packs and folders into their workspace.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleJoinTeam} className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          maxLength={10}
                          value={inputJoinCode}
                          onChange={(e) => setInputJoinCode(e.target.value.toUpperCase())}
                          placeholder="ENTER 6-DIGIT CODE"
                          className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-mono font-bold text-center tracking-widest uppercase text-sm sm:text-base focus:outline-none focus:ring-1 focus:ring-black"
                        />
                        <Button 
                          type="submit" 
                          disabled={joinLoading || !inputJoinCode.trim()} 
                          isLoading={joinLoading}
                          className="bg-black text-white px-6 py-2.5 shrink-0 font-bold text-xs uppercase tracking-wider rounded-xl"
                        >
                          {joinLoading ? 'Joining...' : 'Join Team'}
                        </Button>
                      </div>

                      {joinSuccess && (
                        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center gap-2 font-medium">
                          <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> {joinSuccess}
                        </div>
                      )}
                      {joinError && (
                        <div className="text-xs text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl flex items-center gap-2 font-medium">
                          <AlertCircle size={16} className="shrink-0 text-red-500" /> {joinError}
                        </div>
                      )}
                    </form>
                  </div>
                </div>
              )}
            </main>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
