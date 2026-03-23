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
          <h1 className="text-4xl font-serif text-gray-900">Tech Pack Pipeline</h1>
          <p className="text-gray-500 mt-2">Manage Garment Technical Specifications.</p>
        </div>
        <Button onClick={() => navigate('/create')} className="gap-2 shrink-0 rounded-full px-6">
          <PlusCircle size={18} />
          New Tech Pack
        </Button>
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
          {techPacks.map(pack => (
            <GlassCard 
              key={pack.id} 
              onClick={() => navigate(`/pack/${pack.id}`, { state: pack })}
              className="p-0 group cursor-pointer hover:border-gray-400 transition-all flex flex-col hover:shadow-md"
            >
              <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden flex flex-col items-center justify-center border-b border-gray-100 p-4">
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
                <p className="text-xs text-gray-400 mt-3 font-medium uppercase tracking-wide">
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
