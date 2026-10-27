import React, { useEffect, useState } from 'react';
import { Database, FileCode, Radio, X, Copy, Check } from 'lucide-react';
import { RTC_CONFIGURATION } from '../useWebRTC';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'sql' | 'manifest' | 'webrtc'>('sql');
  const [schemaSql, setSchemaSql] = useState<string>('');
  const [manifestJson, setManifestJson] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/architecture-files')
      .then((res) => res.json())
      .then((data) => {
        if (data.schemaSql) setSchemaSql(data.schemaSql);
        if (data.manifestJson) setManifestJson(data.manifestJson);
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const activeCode =
    activeTab === 'sql'
      ? schemaSql
      : activeTab === 'manifest'
      ? manifestJson
      : JSON.stringify(RTC_CONFIGURATION, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arch-modal-title"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-[#0F172A] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 id="arch-modal-title" className="text-base font-semibold text-white">
              Wapper Open-Source Free-Tier Architecture ($0/mo)
            </h2>
            <p className="text-xs text-slate-400">
              PostgreSQL DDL (`schema.sql`), Standalone PWA Manifest (`manifest.json`), and Google STUN WebRTC Mesh
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Architecture Modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-3 flex items-center justify-between border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('sql')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'sql'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>schema.sql (PostgreSQL)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manifest')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'manifest'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>manifest.json (PWA)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('webrtc')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'webrtc'
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>WebRTC STUN Mesh</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="mb-1.5 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 bg-slate-950">
          <pre className="text-xs font-mono text-slate-300 leading-relaxed overflow-x-auto">
            <code>{activeCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default ArchitectureModal;
