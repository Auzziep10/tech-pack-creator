import React, { useEffect, useState } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { 
  PlusCircle, 
  Image as ImageIcon, 
  Trash2, 
  Folder, 
  FolderPlus, 
  FolderInput, 
  MoreVertical, 
  Edit2, 
  ChevronRight,
  Home
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  getUserAndCompanyTechPacks, 
  TechPackData, 
  FolderData, 
  getCompanyFolders, 
  createFolder, 
  updateFolder, 
  updateFolderParent,
  deleteFolder, 
  updateTechPackFolder, 
  moveTechPacksToFolder 
} from '../services/dbService';
import { db } from '../services/firebase';
import { writeBatch, doc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { getCompanyGarmentQueue, deleteQueueItem } from '../services/wovnService';
import { WovnImportModal } from '../components/ui/WovnImportModal';
import { FolderModal } from '../components/ui/FolderModal';

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
  
  // Folders State
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>('ALL'); // 'ALL' | 'UNASSIGNED' | folderId
  const [activeFolderMenuId, setActiveFolderMenuId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Folder Modal State
  const [folderModalState, setFolderModalState] = useState<{
    isOpen: boolean;
    mode: 'create' | 'rename' | 'move';
    initialName?: string;
    targetPackIds?: string[];
    targetFolderId?: string | null;
    parentFolderId?: string | null;
    targetFolderObj?: FolderData;
  }>({
    isOpen: false,
    mode: 'create'
  });

  // Wovn Queue State
  const [wovnCustomerIds, setWovnCustomerIds] = useState<string[]>([]);
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [isWovnModalOpen, setIsWovnModalOpen] = useState(false);

  const loadQueue = async (companyId: string) => {
    try {
      const items = await getCompanyGarmentQueue(companyId);
      setQueueItems(items);
    } catch (err) {
      console.error("Error loading queue:", err);
    }
  };

  const loadFolders = async (companyId: string) => {
    try {
      const data = await getCompanyFolders(companyId);
      setFolders(data);
    } catch (err) {
      console.error("Error loading folders:", err);
    }
  };

  useEffect(() => {
    if (user && profile?.companyId) {
      loadFolders(profile.companyId);
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

      // Fetch company doc for wovn integration
      const unsubscribeCompany = onSnapshot(doc(db, 'companies', profile.companyId), snap => {
        if (snap.exists()) {
          const data = snap.data();
          let ids: string[] = data.wovnCustomerIds || [];
          if (data.wovnCustomerId && !ids.includes(data.wovnCustomerId)) {
             ids.push(data.wovnCustomerId);
          }
          setWovnCustomerIds(ids);
          if (ids.length > 0) {
            loadQueue(profile.companyId);
          } else {
            setQueueItems([]);
          }
        }
      });

      return () => unsubscribeCompany();
    }
  }, [user, profile]);

  const handleDelete = async (e: React.MouseEvent, packId?: string) => {
    e.stopPropagation(); // prevent card click
    if (!packId) return;
    
    if (window.confirm("Are you sure you want to permanently delete this Tech Pack?")) {
      try {
        await deleteDoc(doc(db, 'techPacks', packId));
        setTechPacks(prev => prev.filter(p => p.id !== packId));
        setSelectedPacks(prev => prev.filter(id => id !== packId));
      } catch (err) {
        console.error("Error deleting tech pack:", err);
        alert("Failed to delete. You might not be authorized.");
      }
    }
  };

  // Folder Operations
  const handleCreateFolderSubmit = async (data: { name?: string; folderId?: string | null; parentId?: string | null }) => {
    if (!profile?.companyId || !user?.uid) return;
    if (folderModalState.mode === 'create') {
      if (!data.name) return;
      const targetParentId = data.parentId !== undefined ? data.parentId : (activeFolderId !== 'ALL' && activeFolderId !== 'UNASSIGNED' ? activeFolderId : null);
      const newId = await createFolder(user.uid, profile.companyId, data.name, targetParentId);
      await loadFolders(profile.companyId);
      setActiveFolderId(newId);
    } else if (folderModalState.mode === 'rename') {
      if (!data.name || !folderModalState.targetFolderObj?.id) return;
      await updateFolder(folderModalState.targetFolderObj.id, data.name);
      await loadFolders(profile.companyId);
    } else if (folderModalState.mode === 'move') {
      let destFolderId = data.folderId;
      if (data.name) {
        // Created a brand new folder during move dialog
        destFolderId = await createFolder(user.uid, profile.companyId, data.name, data.parentId || null);
        await loadFolders(profile.companyId);
      }
      if (folderModalState.targetPackIds && folderModalState.targetPackIds.length > 0) {
        await moveTechPacksToFolder(folderModalState.targetPackIds, destFolderId || null);
        setTechPacks(prev =>
          prev.map(p => (p.id && folderModalState.targetPackIds?.includes(p.id) ? { ...p, folderId: destFolderId } : p))
        );
      }
    }
  };

  const handleDeleteFolder = async (folder: FolderData) => {
    if (!folder.id || !profile?.companyId) return;
    if (window.confirm(`Delete folder "${folder.name}"? Subfolders and garments inside will be moved up.`)) {
      try {
        await deleteFolder(folder.id);
        await loadFolders(profile.companyId);
        if (activeFolderId === folder.id) {
          setActiveFolderId(folder.parentId || 'ALL');
        }
      } catch (err) {
        console.error("Error deleting folder:", err);
        alert("Failed to delete folder.");
      }
    }
  };

  // Drag and Drop into Folder Tab
  const handleDropOnFolder = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    setDragOverFolderId(null);

    const draggedFolderId = e.dataTransfer.getData('folder-id');
    const packId = e.dataTransfer.getData('text/plain');

    const destId = targetFolderId === 'ALL' || targetFolderId === 'UNASSIGNED' ? null : targetFolderId;

    if (draggedFolderId) {
      if (draggedFolderId === destId) return;
      try {
        await updateFolderParent(draggedFolderId, destId);
        if (profile?.companyId) await loadFolders(profile.companyId);
      } catch (err) {
        console.error("Error moving folder:", err);
      }
      return;
    }

    if (packId) {
      try {
        await updateTechPackFolder(packId, destId);
        setTechPacks(prev => prev.map(p => (p.id === packId ? { ...p, folderId: destId } : p)));
      } catch (err) {
        console.error("Error dropping pack into folder:", err);
      }
    }
  };

  // Helper functions for nested folders
  const getAllDescendantFolderIds = (folderId: string): string[] => {
    let ids: string[] = [folderId];
    const children = folders.filter(f => f.parentId === folderId && f.id);
    children.forEach(child => {
      if (child.id) {
        ids = ids.concat(getAllDescendantFolderIds(child.id));
      }
    });
    return ids;
  };

  const getFolderTotalCount = (folderId: string): number => {
    const allIds = getAllDescendantFolderIds(folderId);
    return techPacks.filter(p => p.folderId && allIds.includes(p.folderId)).length;
  };

  // Filter tech packs based on active folder selection (includes garments in active folder and its subfolders)
  const filteredTechPacks = techPacks.filter(pack => {
    if (activeFolderId === 'ALL') return true;
    if (activeFolderId === 'UNASSIGNED') return !pack.folderId;
    const allFolderIds = getAllDescendantFolderIds(activeFolderId);
    return pack.folderId && allFolderIds.includes(pack.folderId);
  });

  // Calculate visible subfolders for the current folder view level
  const getVisibleFolders = (): FolderData[] => {
    if (activeFolderId === 'ALL') {
      return folders.filter(f => !f.parentId);
    }
    if (activeFolderId === 'UNASSIGNED') {
      return [];
    }
    return folders.filter(f => f.parentId === activeFolderId);
  };
  const visibleFolders = getVisibleFolders();

  // Breadcrumbs calculation
  const getBreadcrumbs = (): { id: string; name: string }[] => {
    if (activeFolderId === 'ALL' || activeFolderId === 'UNASSIGNED') return [];
    const crumbs: { id: string; name: string }[] = [];
    let currentId: string | null = activeFolderId;

    while (currentId) {
      const folder = folders.find(f => f.id === currentId);
      if (!folder) break;
      crumbs.unshift({ id: folder.id!, name: folder.name });
      currentId = folder.parentId || null;
    }
    return crumbs;
  };
  const breadcrumbs = getBreadcrumbs();

  const getFolderMap = () => {
    const map: Record<string, string> = {};
    folders.forEach(f => {
      if (f.id) map[f.id] = f.name;
    });
    return map;
  };
  const folderMap = getFolderMap();

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
                  setFolderModalState({
                    isOpen: true,
                    mode: 'move',
                    targetPackIds: selectedPacks
                  });
                }}
                disabled={selectedPacks.length === 0}
                variant="secondary"
                className="shrink-0 rounded-full px-5 h-10 font-bold flex items-center gap-2 border-gray-300 hover:bg-gray-100"
              >
                <FolderInput size={18} />
                <span>Move Selected ({selectedPacks.length})</span>
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

      {wovnCustomerIds.length > 0 && queueItems.length > 0 && (
        <div className="mb-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif font-bold text-gray-900 border-b-2 border-black inline-block pb-1">Pending Wovn Scans ({queueItems.length})</h2>
            <Button onClick={() => setIsWovnModalOpen(true)} variant="secondary" className="text-xs shrink-0 rounded-full px-4 h-8">
              + Import More
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {queueItems.map(item => (
              <GlassCard 
                key={item.id} 
                className="p-3 cursor-pointer hover:shadow-md hover:border-gray-800 transition-all flex flex-col group bg-amber-50/30 border-amber-200/50"
                onClick={() => navigate('/create', { state: { queueItem: item } })}
                onContextMenu={async (e) => {
                  e.preventDefault();
                  if (window.confirm("Remove this item from the queue?")) {
                    try {
                      await deleteQueueItem(item.id);
                      setQueueItems(prev => prev.filter(q => q.id !== item.id));
                    } catch (err) {
                      console.error("Error removing queue item:", err);
                      alert("Failed to remove queue item.");
                    }
                  }
                }}
              >
                <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center mb-3">
                  {item.wovnItem?.mock_image ? (
                    <img src={item.wovnItem.mock_image} className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon size={24} className="text-gray-300" />
                  )}
                </div>
                <h4 className="font-bold text-xs text-gray-900 truncate">{item.wovnItem?.garment_name || 'Queued Item'}</h4>
                <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-semibold flex items-center justify-between">
                  <span>Pending Scan</span>
                  <span className="bg-black text-white px-1.5 rounded-full text-[8px] opacity-0 group-hover:opacity-100 transition-opacity">START</span>
                </p>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {wovnCustomerIds.length > 0 && queueItems.length === 0 && (
         <div className="flex items-start justify-end -mt-4 mb-4">
           <Button onClick={() => setIsWovnModalOpen(true)} variant="secondary" className="text-xs shrink-0 rounded-full px-4 h-8 bg-blue-50 text-blue-700 hover:bg-blue-100 border-none">
              Import from WOVN
           </Button>
         </div>
      )}

      {/* --- Breadcrumb Trail for Nested Folders --- */}
      {breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50/80 border border-gray-200/80 rounded-xl px-4 py-2 w-fit">
          <button
            onClick={() => setActiveFolderId('ALL')}
            className="flex items-center gap-1 hover:text-black font-semibold transition-colors"
          >
            <Home size={13} />
            <span>All Garments</span>
          </button>
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.id}>
                <ChevronRight size={13} className="text-gray-400 shrink-0" />
                <button
                  onClick={() => setActiveFolderId(crumb.id)}
                  className={`font-semibold transition-colors ${
                    isLast ? 'text-black font-bold' : 'hover:text-black'
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* --- Folder Navigation & Filter Bar --- */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-2 border-b border-gray-200 no-scrollbar">
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveFolderId('ALL')}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setDragOverFolderId('ALL')}
            onDragLeave={() => setDragOverFolderId(null)}
            onDrop={(e) => handleDropOnFolder(e, 'ALL')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
              activeFolderId === 'ALL'
                ? 'bg-black text-white shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            } ${dragOverFolderId === 'ALL' ? 'ring-2 ring-blue-500 scale-105' : ''}`}
          >
            <span>All Garments</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeFolderId === 'ALL' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
              {techPacks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveFolderId('UNASSIGNED')}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setDragOverFolderId('UNASSIGNED')}
            onDragLeave={() => setDragOverFolderId(null)}
            onDrop={(e) => handleDropOnFolder(e, 'UNASSIGNED')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
              activeFolderId === 'UNASSIGNED'
                ? 'bg-black text-white shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            } ${dragOverFolderId === 'UNASSIGNED' ? 'ring-2 ring-blue-500 scale-105' : ''}`}
          >
            <span>Unassigned</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeFolderId === 'UNASSIGNED' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
              {techPacks.filter(p => !p.folderId).length}
            </span>
          </button>

          {visibleFolders.map(folder => {
            if (!folder.id) return null;
            const isSelected = activeFolderId === folder.id;
            const count = getFolderTotalCount(folder.id);
            const isMenuOpen = activeFolderMenuId === folder.id;
            const isDragTarget = dragOverFolderId === folder.id;

            return (
              <div
                key={folder.id}
                draggable
                onDragStart={(e) => {
                  if (folder.id) e.dataTransfer.setData('folder-id', folder.id);
                }}
                className="relative group shrink-0"
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={() => setDragOverFolderId(folder.id || null)}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={(e) => handleDropOnFolder(e, folder.id!)}
              >
                <div
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-black text-white shadow-sm'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  } ${isDragTarget ? 'ring-2 ring-blue-500 scale-105' : ''}`}
                  onClick={() => setActiveFolderId(folder.id!)}
                >
                  <Folder size={14} className={isSelected ? 'text-white' : 'text-gray-500'} />
                  <span>{folder.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
                    {count}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveFolderMenuId(isMenuOpen ? null : folder.id!);
                    }}
                    className={`p-1 rounded-full hover:bg-black/10 transition-colors ${isSelected ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}
                  >
                    <MoreVertical size={13} />
                  </button>
                </div>

                {/* Folder Action Popover */}
                {isMenuOpen && (
                  <div
                    className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl p-1 z-50 animate-in fade-in slide-in-from-top-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setActiveFolderMenuId(null);
                        setFolderModalState({
                          isOpen: true,
                          mode: 'create',
                          parentFolderId: folder.id
                        });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-lg text-left"
                    >
                      <FolderPlus size={13} className="text-gray-400" />
                      <span>+ Create Subfolder</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveFolderMenuId(null);
                        setFolderModalState({
                          isOpen: true,
                          mode: 'rename',
                          initialName: folder.name,
                          targetFolderObj: folder
                        });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-lg text-left"
                    >
                      <Edit2 size={13} className="text-gray-400" />
                      <span>Rename Folder</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveFolderMenuId(null);
                        handleDeleteFolder(folder);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg text-left border-t border-gray-50 mt-1 pt-2"
                    >
                      <Trash2 size={13} />
                      <span>Delete Folder</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => {
            setFolderModalState({
              isOpen: true,
              mode: 'create',
              parentFolderId: activeFolderId !== 'ALL' && activeFolderId !== 'UNASSIGNED' ? activeFolderId : null
            });
          }}
          className="shrink-0 px-4 py-2 rounded-full border border-dashed border-gray-300 hover:border-black text-xs font-bold text-gray-700 hover:text-black hover:bg-gray-50 transition-all flex items-center gap-1.5"
        >
          <FolderPlus size={15} />
          <span>{activeFolderId !== 'ALL' && activeFolderId !== 'UNASSIGNED' ? '+ New Subfolder' : '+ New Folder'}</span>
        </button>
      </div>

      <WovnImportModal 
        isOpen={isWovnModalOpen} 
        onClose={() => setIsWovnModalOpen(false)} 
        wovnCustomerIds={wovnCustomerIds}
        onImportComplete={() => {
          if (profile?.companyId) loadQueue(profile.companyId);
        }}
      />

      <FolderModal
        isOpen={folderModalState.isOpen}
        onClose={() => setFolderModalState(prev => ({ ...prev, isOpen: false }))}
        mode={folderModalState.mode}
        initialFolderName={folderModalState.initialName}
        folders={folders}
        currentFolderId={folderModalState.targetFolderId}
        parentFolderId={folderModalState.parentFolderId}
        targetCount={folderModalState.targetPackIds?.length || 1}
        onSubmit={handleCreateFolderSubmit}
      />

      {loading ? (
        <div className="py-20 flex justify-center text-gray-400">Loading...</div>
      ) : filteredTechPacks.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-500 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4 border border-gray-200">
            <Folder size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {activeFolderId === 'ALL'
              ? 'No tech packs yet'
              : activeFolderId === 'UNASSIGNED'
              ? 'No unassigned tech packs'
              : 'Folder is empty'}
          </h3>
          <p className="max-w-sm mb-6">
            {activeFolderId === 'ALL'
              ? 'Create your first garment tech pack.'
              : 'Move garments into this folder or drag & drop them here.'}
          </p>
          {activeFolderId === 'ALL' && (
            <Button onClick={() => navigate('/create')} variant="primary" className="rounded-full px-6">Get Started</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
          {filteredTechPacks.map(pack => {
            const isSelected = pack.id ? selectedPacks.includes(pack.id) : false;
            const folderName = pack.folderId ? folderMap[pack.folderId] : null;

            return (
              <GlassCard 
                key={pack.id} 
                draggable={!isSelectMode}
                onDragStart={(e) => {
                  if (pack.id) e.dataTransfer.setData('text/plain', pack.id);
                }}
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

                  {/* Folder Tag Badge & Move button */}
                  {!isSelectMode && (
                    <div className="absolute top-3 left-3 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pack.id) {
                            setFolderModalState({
                              isOpen: true,
                              mode: 'move',
                              targetPackIds: [pack.id],
                              targetFolderId: pack.folderId || null
                            });
                          }
                        }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-sm backdrop-blur-sm ${
                          folderName
                            ? 'bg-gray-100/90 text-gray-800 hover:bg-gray-200 border border-gray-200'
                            : 'bg-white/80 text-gray-500 hover:bg-white hover:text-black border border-gray-200 opacity-80 group-hover:opacity-100'
                        }`}
                        title="Change folder"
                      >
                        <Folder size={11} className={folderName ? 'text-gray-600' : 'text-gray-400'} />
                        <span className="max-w-[100px] truncate">{folderName || 'Assign Folder'}</span>
                      </button>
                    </div>
                  )}

                  {(!isSelectMode && (profile?.role === 'admin' || pack.userId === user?.uid)) && (
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
