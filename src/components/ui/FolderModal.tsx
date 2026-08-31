import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { FolderData } from '../../services/dbService';
import { Folder, FolderPlus, Check, CornerDownRight } from 'lucide-react';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'rename' | 'move';
  initialFolderName?: string;
  folders?: FolderData[];
  currentFolderId?: string | null;
  parentFolderId?: string | null;
  targetCount?: number;
  onSubmit: (data: { name?: string; folderId?: string | null; parentId?: string | null }) => Promise<void>;
}

export function FolderModal({
  isOpen,
  onClose,
  mode,
  initialFolderName = '',
  folders = [],
  currentFolderId = null,
  parentFolderId = null,
  targetCount = 1,
  onSubmit
}: FolderModalProps) {
  const [folderName, setFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(parentFolderId);
  const [loading, setLoading] = useState(false);
  const [isCreatingNewInMove, setIsCreatingNewInMove] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFolderName(initialFolderName);
      setSelectedFolderId(currentFolderId);
      setSelectedParentId(parentFolderId);
      setIsCreatingNewInMove(false);
      setLoading(false);
    }
  }, [isOpen, initialFolderName, currentFolderId, parentFolderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'create' || mode === 'rename' || (mode === 'move' && isCreatingNewInMove)) {
        if (!folderName.trim()) return;
        await onSubmit({ name: folderName.trim(), parentId: selectedParentId });
      } else {
        await onSubmit({ folderId: selectedFolderId });
      }
      onClose();
    } catch (err) {
      console.error('Error in FolderModal submit:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (mode === 'create') return selectedParentId ? 'Create Subfolder' : 'Create New Folder';
    if (mode === 'rename') return 'Rename Folder';
    return targetCount > 1 ? `Move ${targetCount} Garments to Folder` : 'Move Garment to Folder';
  };

  // Build ordered folder tree for indented selector list
  const getOrderedFolderTree = (allFolders: FolderData[], parentId: string | null = null, depth = 0): { folder: FolderData; depth: number }[] => {
    const result: { folder: FolderData; depth: number }[] = [];
    const children = allFolders.filter(f => (f.parentId || null) === parentId);
    children.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    for (const child of children) {
      if (child.id) {
        result.push({ folder: child, depth });
        result.push(...getOrderedFolderTree(allFolders, child.id, depth + 1));
      }
    }
    return result;
  };

  const folderTree = getOrderedFolderTree(folders);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getTitle()}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {(mode === 'create' || mode === 'rename' || isCreatingNewInMove) ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Folder Name
              </label>
              <input
                type="text"
                required
                autoFocus
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g. Outerwear, Jackets, Fall 2026..."
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all"
              />
            </div>

            {mode === 'create' && folders.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Parent Location
                </label>
                <select
                  value={selectedParentId || ''}
                  onChange={(e) => setSelectedParentId(e.target.value || null)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="">Root (Top Level)</option>
                  {folderTree.map(({ folder, depth }) => (
                    <option key={folder.id} value={folder.id}>
                      {'\u00A0\u00A0'.repeat(depth)}{depth > 0 ? '↳ ' : ''}{folder.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isCreatingNewInMove && (
              <button
                type="button"
                onClick={() => setIsCreatingNewInMove(false)}
                className="text-xs text-gray-500 hover:text-black underline"
              >
                ← Choose existing folder
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Destination Folder
            </label>
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all ${
                  selectedFolderId === null
                    ? 'border-black bg-black/5 text-black font-semibold ring-1 ring-black'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                    <Folder size={16} />
                  </div>
                  <span>Unassigned (No Folder)</span>
                </div>
                {selectedFolderId === null && <Check size={18} className="text-black" />}
              </button>

              {folderTree.map(({ folder, depth }) => {
                const isSelected = selectedFolderId === folder.id;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setSelectedFolderId(folder.id || null)}
                    style={{ paddingLeft: `${12 + depth * 20}px` }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-black bg-black/5 text-black font-semibold ring-1 ring-black'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {depth > 0 && <CornerDownRight size={14} className="text-gray-400 shrink-0" />}
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                        <Folder size={15} />
                      </div>
                      <span className="truncate">{folder.name}</span>
                    </div>
                    {isSelected && <Check size={18} className="text-black shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setFolderName('');
                  setIsCreatingNewInMove(true);
                }}
                className="flex items-center gap-2 text-xs font-semibold text-gray-900 hover:text-black hover:underline"
              >
                <FolderPlus size={16} />
                <span>+ Create new folder for this garment</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose} className="rounded-xl px-5">
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="rounded-xl px-5 font-bold">
            {loading
              ? 'Saving...'
              : mode === 'create' || isCreatingNewInMove
              ? 'Create Folder'
              : mode === 'rename'
              ? 'Save Name'
              : 'Move Garment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
