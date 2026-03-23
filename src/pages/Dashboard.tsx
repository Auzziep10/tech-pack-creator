import React, { useEffect, useState } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { PlusCircle, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserTechPacks, TechPackData } from '../services/dbService';

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [techPacks, setTechPacks] = useState<TechPackData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      getUserTechPacks(user.uid)
        .then(data => setTechPacks(data))
        .catch(err => console.error("Error fetching tech packs:", err))
        .finally(() => setLoading(false));
    }
  }, [user]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Tech Packs</h1>
          <p className="text-gray-400 mt-1">Manage your Garment Technical Specifications.</p>
        </div>
        <Button onClick={() => navigate('/create')} className="gap-2 shrink-0">
          <PlusCircle size={18} />
          New Tech Pack
        </Button>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center text-gray-400">Loading...</div>
      ) : techPacks.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
            <PlusCircle size={24} className="text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No tech packs yet</h3>
          <p className="max-w-sm mb-6">Create your first garment tech pack using AI analysis.</p>
          <Button onClick={() => navigate('/create')} variant="secondary">Get Started</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
          {techPacks.map(pack => (
            <GlassCard 
              key={pack.id} 
              onClick={() => navigate(`/pack/${pack.id}`, { state: pack })}
              className="p-0 group cursor-pointer hover:border-blue-500/50 transition-colors flex flex-col"
            >
              <div className="aspect-[4/3] bg-black/40 relative overflow-hidden flex flex-col items-center justify-center border-b border-white/5 p-4">
                {pack.imageUrl ? (
                  <img src={pack.imageUrl} alt={pack.name} className="w-full h-full object-contain drop-shadow-lg" />
                ) : (
                  <>
                    <ImageIcon size={40} className="text-white/10 mb-2" />
                    <span className="text-gray-600 text-sm font-medium">No Image</span>
                  </>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors text-lg truncate">{pack.name}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {pack.updatedAt?.toDate ? pack.updatedAt.toDate().toLocaleDateString() : 'Just now'}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
