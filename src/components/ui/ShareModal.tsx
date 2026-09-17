import React, { useState } from 'react';
import { Modal } from './Modal';
import { Copy, Check, ExternalLink, ShieldCheck, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  packId: string;
  packName?: string;
}

export function ShareModal({ isOpen, onClose, packId, packName }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const shareUrl = `${window.location.origin}/shared/${packId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const handleOpenPreview = () => {
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Tech Pack" maxWidth="max-w-md">
      <div className="space-y-5">
        <div>
          <h3 className="text-base font-bold text-gray-900 truncate">
            {packName || 'Untitled Tech Pack'}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Anyone with this link can view the complete specifications and all photos in read-only mode.
          </p>
        </div>

        {/* Security & Isolation Callout */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
          <ShieldCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900 leading-relaxed">
            <span className="font-bold">Private & Isolated:</span> Recipients cannot edit anything, cannot view your dashboard, and have zero access to your other garments or account.
          </div>
        </div>

        {/* Share Link Input & Copy */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Shareable Link
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 font-mono select-all truncate">
              {shareUrl}
            </div>
            <button
              onClick={handleCopy}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-black text-white hover:bg-gray-800 shadow-sm'
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons: Preview & QR */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleOpenPreview}
            className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-800 text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <ExternalLink size={14} className="text-gray-500" />
            <span>Open Preview</span>
          </button>
          <button
            onClick={() => setShowQr(!showQr)}
            className={`border text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              showQr 
                ? 'bg-gray-100 border-gray-300 text-gray-900' 
                : 'border-gray-200 hover:bg-gray-50 text-gray-800'
            }`}
          >
            <QrCode size={14} className="text-gray-500" />
            <span>{showQr ? 'Hide QR' : 'Show QR'}</span>
          </button>
        </div>

        {/* QR Code Container */}
        {showQr && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
              <QRCodeSVG value={shareUrl} size={160} level="M" />
            </div>
            <span className="text-[11px] text-gray-500 font-medium text-center">
              Scan with mobile phone or tablet to view tech pack instantly
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
