import React, { useState, useEffect } from 'react';
import { X, Search, PlusCircle, CheckCircle2 } from 'lucide-react';
import { fetchWovnDecksAndItems, addWovnItemToCompanyQueue } from '../../services/wovnService';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  wovnCustomerId: string;
  onImportComplete: () => void;
}

export function WovnImportModal({ isOpen, onClose, wovnCustomerId, onImportComplete }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [decks, setDecks] = useState<any[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen && wovnCustomerId) {
      setLoading(true);
      fetchWovnDecksAndItems(wovnCustomerId)
        .then(data => {
          setDecks(data);
          if (data.length > 0) setSelectedDeckId(data[0].id);
        })
        .catch(err => console.error("Error fetching Wovn data:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, wovnCustomerId]);

  if (!isOpen) return null;

  const handleImport = async (item: any) => {
    if (!profile?.companyId) return;
    setImporting(item.id);
    try {
      await addWovnItemToCompanyQueue(profile.companyId, profile.uid, item);
      onImportComplete();
    } catch (e) {
      console.error(e);
      alert('Failed to import garment. Network error.');
    } finally {
      setImporting(null);
    }
  };

  const selectedDeck = decks.find(d => d.id === selectedDeckId);

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-serif font-bold text-gray-900 flex items-center gap-2">
              Import from WOVN Garment Catalog
            </h2>
            <p className="text-sm text-gray-500 mt-1">Select items from your client presentation decks to add to the Tech Pack Queue.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100">
             <X size={20} />
          </button>
        </header>
        
        <div className="flex-1 flex overflow-hidden">
          {/* Deck Sidebar */}
          <div className="w-1/3 border-r border-gray-100 bg-gray-50/50 flex flex-col p-4 overflow-y-auto">
             <h3 className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-4 px-2">Decks</h3>
             {loading ? (
               <div className="p-4 text-center text-gray-400 text-sm">Loading Decks...</div>
             ) : decks.length === 0 ? (
               <div className="p-4 text-center text-gray-400 text-sm">No decks found for Customer ID {wovnCustomerId}.</div>
             ) : (
               <div className="space-y-2">
                 {decks.map(deck => (
                   <button 
                     key={deck.id}
                     onClick={() => setSelectedDeckId(deck.id)}
                     className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                       selectedDeckId === deck.id ? 'bg-black text-white shadow-md' : 'hover:bg-gray-100 text-gray-700'
                     }`}
                   >
                     <div className="font-bold text-sm truncate">{deck.name}</div>
                     <div className={`text-xs mt-0.5 opacity-80 ${selectedDeckId !== deck.id ? 'text-gray-500' : ''}`}>
                       {deck.items?.length || 0} Items
                     </div>
                   </button>
                 ))}
               </div>
             )}
          </div>
          
          {/* Deck Items View */}
          <div className="w-2/3 flex flex-col bg-white overflow-y-auto p-6">
             {selectedDeck && (
               <>
                 <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-serif font-bold text-gray-900">{selectedDeck.name}</h3>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Search items..." 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-black transition-colors"
                      />
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-max">
                   {selectedDeck.items?.filter((item: any) => 
                     !search || item.garment_name.toLowerCase().includes(search.toLowerCase())
                   ).map((item: any) => (
                      <div key={item.id} className="border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow group bg-white flex flex-col">
                        <div className="h-40 bg-gray-50 p-4 border-b border-gray-100 flex items-center justify-center relative">
                           {item.mock_image ? (
                             <img src={item.mock_image} alt={item.garment_name} className="h-full w-full object-contain" />
                           ) : (
                             <div className="text-gray-400">No Image</div>
                           )}
                           <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleImport(item)} 
                                disabled={importing !== null}
                                className="bg-black text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-gray-800 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2"
                              >
                                {importing === item.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <PlusCircle size={16} />}
                                Add to Queue
                              </button>
                           </div>
                        </div>
                        <div className="p-4 flex flex-col flex-1">
                          <h4 className="font-bold text-gray-900 text-sm truncate">{item.garment_name}</h4>
                          {item.fabric_details && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.fabric_details}</p>
                          )}
                          <div className="mt-auto pt-3 flex items-center gap-2">
                            {item.category && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">{item.category}</span>}
                            {item.gender && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">{item.gender}</span>}
                          </div>
                        </div>
                      </div>
                   ))}
                   {selectedDeck.items?.length === 0 && (
                     <div className="col-span-2 text-center py-10 text-gray-500">This deck is empty.</div>
                   )}
                 </div>
               </>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
