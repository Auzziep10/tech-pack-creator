import React, { useEffect, useState } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { PlusCircle, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserAndCompanyTechPacks, TechPackData } from '../services/dbService';
import { db } from '../services/firebase';
import { writeBatch, doc, deleteDoc, getDoc } from 'firebase/firestore';

const formatName = (email?: string | null) => {
  if (!email) return 'Teammate';
  const namePart = email.split('@')[0];
  return namePart.split(/[\.\-_]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
};

export function Dashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [techPacks, setTechPacks] = useState<TechPackData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedPacks, setSelectedPacks] = useState<string[]>([]);

  useEffect(() => {
    if (user && profile?.companyId) {
      getUserAndCompanyTechPacks(user.uid, profile.companyId)
        .then(async data => {
          setTechPacks(data);

          // Auto-migrate orphaned packs that user securely owns but aren't currently bound to the active team
          const orphanedPacks = data.filter(p => p.userId === user.uid && p.companyId !== profile.companyId);
          if (orphanedPacks.length > 0) {
            try {
              const batch = writeBatch(db);
              let count = 0;
              orphanedPacks.forEach(p => {
                if (p.id) {
                   batch.update(doc(db, 'techPacks', p.id), { companyId: profile.companyId });
                   count++;
                }
              });
              if (count > 0) await batch.commit();
            } catch(e) {
              console.error("Auto-migration failed:", e);
            }
          }
          // Fetch and auto-hydrate missing author emails for legacy collaborative tech packs
          const missingEmailUsers = Array.from(new Set(data.filter(p => !p.creatorEmail && p.userId).map(p => p.userId)));
          if (missingEmailUsers.length > 0) {
            try {
              const userDocs = await Promise.all(missingEmailUsers.map(uid => getDoc(doc(db, 'users', uid))));
              const emailMap: Record<string, string> = {};
              userDocs.forEach(d => {
                if (d.exists() && d.data().email) emailMap[d.id] = d.data().email;
              });

              let hydrated = false;
              const batch = writeBatch(db);
              let batchCount = 0;

              data.forEach(p => {
                if (!p.creatorEmail && emailMap[p.userId]) {
                  p.creatorEmail = emailMap[p.userId];
                  hydrated = true;
                  if (p.id) {
                    batch.update(doc(db, 'techPacks', p.id), { creatorEmail: emailMap[p.userId] });
                    batchCount++;
                  }
                }
              });

              if (hydrated) {
                setTechPacks([...data]);
                if (batchCount > 0) await batch.commit();
              }
            } catch (e) {
              console.error("Email hydration failed:", e);
            }
          }
        })
        .catch(err => console.error("Error fetching tech packs:", err))
        .finally(() => setLoading(false));
    }
  }, [user, profile]);

  const handleDelete = async (e: React.MouseEvent, packId?: string) => {
    e.stopPropagation(); // prevent card click
    if (!packId) return;
    
    if (window.confirm("Are you sure you want to permanently delete this Tech Pack?")) {
      try {
        await deleteDoc(doc(db, 'techPacks', packId));
        setTechPacks(prev => prev.filter(p => p.id !== packId));
      } catch (err) {
        console.error("Error deleting tech pack:", err);
        alert("Failed to delete. You might not be authorized.");
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif text-gray-900">Tech Pack Pipeline</h1>
          <p className="text-gray-500 mt-2">Manage Garment Technical Specifications.</p>
        </div>
        <div className="flex items-center gap-3">
          {isSelectMode ? (
            <>
              <Button onClick={() => { setIsSelectMode(false); setSelectedPacks([]); }} variant="secondary" className="rounded-full px-6 h-10">
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  const selectedData = techPacks.filter(p => p.id && selectedPacks.includes(p.id));
                  navigate('/combo-linesheet', { state: { packs: selectedData } });
                }} 
                disabled={selectedPacks.length === 0}
                className="shrink-0 rounded-full px-6 bg-black text-white h-10 font-bold"
              >
                Generate Combo Line Sheet ({selectedPacks.length})
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setIsSelectMode(true)} variant="secondary" className="rounded-full px-6 hidden sm:block h-10 font-bold">
                Select Multiple
              </Button>
              <Button onClick={() => navigate('/create')} className="shrink-0 rounded-full px-6 h-10 font-bold">
                <div className="flex items-center gap-2">
                  <PlusCircle size={18} />
                  <span>New Tech Pack</span>
                </div>
              </Button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center text-gray-400">Loading...</div>
      ) : techPacks.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-500 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4 border border-gray-200">
            <PlusCircle size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No tech packs yet</h3>
          <p className="max-w-sm mb-6">Create your first garment tech pack using AI analysis.</p>
          <Button onClick={() => navigate('/create')} variant="primary" className="rounded-full px-6">Get Started</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
          {techPacks.map(pack => {
            const isSelected = pack.id ? selectedPacks.includes(pack.id) : false;
            return (
              <GlassCard 
                key={pack.id} 
                onClick={() => {
                  if (isSelectMode && pack.id) {
                    setSelectedPacks(prev => isSelected ? prev.filter(id => id !== pack.id) : [...prev, pack.id as string]);
                  } else {
                    navigate(`/pack/${pack.id}`, { state: pack });
                  }
                }}
                className={`p-0 group cursor-pointer transition-all flex flex-col hover:shadow-md ${isSelectMode ? 'hover:border-blue-400' : 'hover:border-gray-400'} ${isSelected ? 'border-2 border-black ring-4 ring-black/10' : ''}`}
              >
                <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden flex flex-col items-center justify-center border-b border-gray-100 p-4">
                  {isSelectMode && (
                    <div className={`absolute top-3 left-3 w-6 h-6 rounded-full border-2 flex items-center justify-center z-20 transition-colors ${isSelected ? 'bg-black border-black text-white' : 'bg-white border-gray-300 shadow-sm'}`}>
                       {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                    </div>
                  )}
                  {(!isSelectMode && pack.userId === user?.uid) && (
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                     <button 
                       onClick={(e) => handleDelete(e, pack.id)}
                       className="bg-white/90 backdrop-blur-sm shadow-sm hover:bg-red-50 text-gray-400 hover:text-red-500 p-2 rounded-xl transition-colors border border-gray-100 hover:border-red-200"
                       title="Delete Tech Pack"
                     >
                       <Trash2 size={16} />
                     </button>
                  </div>
                )}
                {pack.imageUrl ? (
                  <img src={pack.imageUrl} alt={pack.name} className="w-full h-full object-contain" />
                ) : (
                  <>
                    <ImageIcon size={40} className="text-gray-200 mb-2" />
                    <span className="text-gray-400 text-sm font-medium">No Image</span>
                  </>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-gray-900 group-hover:text-black transition-colors text-lg truncate">{pack.name}</h3>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                     <div className="bg-black w-full h-full" />
                  </div>
                  <span className="text-xs font-semibold text-gray-500">100%</span>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-[10px] text-gray-400 font-medium truncate pr-2">
                    By: {pack.userId === user?.uid ? 'You' : formatName(pack.creatorEmail)}
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide shrink-0">
                    {pack.updatedAt?.toDate ? pack.updatedAt.toDate().toLocaleDateString() : 'Just now'}
                  </p>
                </div>
              </div>
            </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
