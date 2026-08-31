import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { FolderData } from '../../services/dbService';
import { Folder, FolderPlus, Check } from 'lucide-react';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'rename' | 'move';
  initialFolderName?: string;
  folders?: FolderData[];
  currentFolderId?: string | null;
  targetCount?: number;
  onSubmit: (data: { name?: string; folderId?: string | null }) => Promise<void>;
}

export function FolderModal({
  isOpen,
  onClose,
  mode,
  initialFolderName = '',
  folders = [],
  currentFolderId = null,
  targetCount = 1,
  onSubmit
}: FolderModalProps) {
  const [folderName, setFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId);
  const [loading, setLoading] = useState(false);
  const [isCreatingNewInMove, setIsCreatingNewInMove] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFolderName(initialFolderName);
      setSelectedFolderId(currentFolderId);
      setIsCreatingNewInMove(false);
      setLoading(false);
    }
  }, [isOpen, initialFolderName, currentFolderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'create' || mode === 'rename' || (mode === 'move' && isCreatingNewInMove)) {
        if (!folderName.trim()) return;
        await onSubmit({ name: folderName.trim() });
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
    if (mode === 'create') return 'Create New Folder';
    if (mode === 'rename') return 'Rename Folder';
    return targetCount > 1 ? `Move ${targetCount} Garments to Folder` : 'Move Garment to Folder';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getTitle()}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {(mode === 'create' || mode === 'rename' || isCreatingNewInMove) ? (
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
              placeholder="e.g. Outerwear, Tops, Fall 2026..."
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition-all"
            />
            {isCreatingNewInMove && (
              <button
                type="button"
                onClick={() => setIsCreatingNewInMove(false)}
                className="mt-2 text-xs text-gray-500 hover:text-black underline"
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
            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
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

              {folders.map((folder) => {
                const isSelected = selectedFolderId === folder.id;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setSelectedFolderId(folder.id || null)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-black bg-black/5 text-black font-semibold ring-1 ring-black'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                        <Folder size={16} />
                      </div>
                      <span>{folder.name}</span>
                    </div>
                    {isSelected && <Check size={18} className="text-black" />}
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
