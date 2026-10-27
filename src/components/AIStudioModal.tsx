import React, { useRef, useState } from 'react';
import {
  Wand2,
  ScanEye,
  Upload,
  X,
  Send,
  Loader2,
  ImagePlus,
  AlertCircle,
} from 'lucide-react';

interface AIStudioModalProps {
  isOpen: boolean;
  channelName: string;
  onClose: () => void;
  onPostToChannel: (payload: {
    content: string;
    attachmentUrl: string;
    attachmentAnalysis?: string;
  }) => void;
}

export const AIStudioModal: React.FC<AIStudioModalProps> = ({
  isOpen,
  channelName,
  onClose,
  onPostToChannel,
}) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'analyze'>('generate');

  // Generate / Edit state (`gemini-nano-banana-2.1`)
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '4:3' | '9:16'>('1:1');
  const [imageSize, setImageSize] = useState<'1K' | '2K'>('1K');
  const [sourceEditImage, setSourceEditImage] = useState<string | null>(null);
  const [sourceEditMime, setSourceEditMime] = useState<string>('image/png');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Analyze Photo state (`gemini-4-argon`)
  const [analyzeImageBase64, setAnalyzeImageBase64] = useState<string | null>(null);
  const [analyzeMimeType, setAnalyzeMimeType] = useState<string>('image/png');
  const [analyzePrompt, setAnalyzePrompt] = useState(
    'Analyze this image and describe its visual design, key subjects, and any notable text or details.'
  );
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const editFileInputRef = useRef<HTMLInputElement | null>(null);
  const analyzeFileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleUploadSourceForEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceEditMime(file.type || 'image/png');
    const reader = new FileReader();
    reader.onload = () => {
      setSourceEditImage(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleUploadForAnalysis = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzeMimeType(file.type || 'image/png');
    setAnalysisResult(null);
    setAnalyzeError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setAnalyzeImageBase64(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleRunGenerateOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setGenError('Please enter a text prompt.');
      return;
    }

    setGenerating(true);
    setGenError(null);
    try {
      const response = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspectRatio,
          imageSize,
          base64Image: sourceEditImage || undefined,
          mimeType: sourceEditMime,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setGenError(data.error || 'Failed to generate image.');
      } else if (data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
      }
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Network error calling Gemini API.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRunPhotoAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analyzeImageBase64) {
      setAnalyzeError('Please upload a photo to analyze first.');
      return;
    }

    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const response = await fetch('/api/gemini/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Image: analyzeImageBase64,
          mimeType: analyzeMimeType,
          prompt: analyzePrompt.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setAnalyzeError(data.error || 'Failed to analyze photo.');
      } else {
        setAnalysisResult(data.analysis);
      }
    } catch (err: unknown) {
      setAnalyzeError(err instanceof Error ? err.message : 'Network error calling Gemini API.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-studio-modal-title"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[#0F172A] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 id="ai-studio-modal-title" className="text-base font-semibold text-white">
              Wapper Gemini Media Studio
            </h2>
            <p className="text-xs text-slate-400">
              Create &amp; edit images (`gemini-nano-banana-2.1`) or analyze uploaded photos (`gemini-4-argon`)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Studio Modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="px-6 pt-3 flex items-center gap-2 border-b border-slate-800/80 bg-slate-950/40">
          <button
            type="button"
            onClick={() => setActiveTab('generate')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'generate'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Create &amp; Edit Image (gemini-nano-banana-2.1)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analyze')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'analyze'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ScanEye className="w-3.5 h-3.5" />
            <span>Analyze Photo (gemini-4-argon)</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'generate' ? (
            <form onSubmit={handleRunGenerateOrEdit} className="space-y-4">
              <div>
                <label
                  htmlFor="gemini-image-prompt"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Image Generation or Edit Prompt
                </label>
                <input
                  id="gemini-image-prompt"
                  type="text"
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    if (genError) setGenError(null);
                  }}
                  placeholder="e.g. A minimalist isometric server rack glowing with cyan fiber optics"
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="aspect-ratio-select"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Aspect Ratio
                  </label>
                  <select
                    id="aspect-ratio-select"
                    value={aspectRatio}
                    onChange={(e) =>
                      setAspectRatio(e.target.value as '1:1' | '16:9' | '4:3' | '9:16')
                    }
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="1:1">1:1 Square</option>
                    <option value="16:9">16:9 Landscape</option>
                    <option value="4:3">4:3 Standard</option>
                    <option value="9:16">9:16 Portrait</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="image-size-select"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Resolution
                  </label>
                  <select
                    id="image-size-select"
                    value={imageSize}
                    onChange={(e) => setImageSize(e.target.value as '1K' | '2K')}
                    className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="1K">1K Standard</option>
                    <option value="2K">2K High-Res</option>
                  </select>
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-300 mb-1">
                    Reference Image (Optional Edit)
                  </span>
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadSourceForEdit}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-2 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                  >
                    <ImagePlus className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{sourceEditImage ? 'Change Base Image' : 'Upload Base Image'}</span>
                  </button>
                </div>
              </div>

              {sourceEditImage && (
                <div className="flex items-center justify-between rounded-lg bg-slate-900/80 border border-slate-800 p-2.5">
                  <div className="flex items-center gap-3">
                    <img
                      src={sourceEditImage}
                      alt="Base image to edit"
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded object-cover border border-slate-700"
                    />
                    <span className="text-xs text-slate-300">
                      Base image attached for image editing
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSourceEditImage(null)}
                    className="text-xs text-rose-400 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}

              {genError && (
                <div
                  role="alert"
                  className="rounded-lg bg-rose-950/50 border border-rose-500/40 p-3 flex items-start gap-2.5 text-xs text-rose-200"
                >
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{genError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="submit"
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {generating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {generating
                      ? 'Generating with gemini-nano-banana-2.1...'
                      : sourceEditImage
                      ? 'Edit Image'
                      : 'Generate Image'}
                  </span>
                </button>
              </div>

              {generatedImageUrl && (
                <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-3">
                  <img
                    src={generatedImageUrl}
                    alt={prompt}
                    referrerPolicy="no-referrer"
                    className="max-h-64 mx-auto rounded-lg object-contain"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        onPostToChannel({
                          content: `Generated with **gemini-nano-banana-2.1**: *${prompt.trim()}*`,
                          attachmentUrl: generatedImageUrl,
                        });
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Share in #{channelName}</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={handleRunPhotoAnalysis} className="space-y-4">
              <div>
                <span className="block text-xs font-medium text-slate-300 mb-1.5">
                  1. Upload Photo for Gemini Understanding (`gemini-4-argon`)
                </span>
                <input
                  ref={analyzeFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadForAnalysis}
                  className="hidden"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => analyzeFileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-white transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{analyzeImageBase64 ? 'Choose Another Photo' : 'Upload Photo'}</span>
                  </button>
                  {analyzeImageBase64 && (
                    <img
                      src={analyzeImageBase64}
                      alt="Uploaded photo preview"
                      referrerPolicy="no-referrer"
                      className="h-12 w-12 rounded-lg object-cover border border-slate-700"
                    />
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="analyze-question-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  2. Question or Analysis Instruction
                </label>
                <input
                  id="analyze-question-input"
                  type="text"
                  value={analyzePrompt}
                  onChange={(e) => setAnalyzePrompt(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {analyzeError && (
                <div
                  role="alert"
                  className="rounded-lg bg-rose-950/50 border border-rose-500/40 p-3 flex items-start gap-2.5 text-xs text-rose-200"
                >
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{analyzeError}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                {analyzeImageBase64 && (
                  <button
                    type="button"
                    onClick={() => {
                      onPostToChannel({
                        content: `Shared photo in **#${channelName}**`,
                        attachmentUrl: analyzeImageBase64,
                        attachmentAnalysis: analysisResult || undefined,
                      });
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Post Photo to #{channelName}</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={analyzing || !analyzeImageBase64}
                  className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {analyzing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ScanEye className="w-3.5 h-3.5" />
                  )}
                  <span>{analyzing ? 'Analyzing with gemini-4-argon...' : 'Analyze Photo'}</span>
                </button>
              </div>

              {analysisResult && (
                <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-3">
                  <div className="text-xs font-semibold text-indigo-300">
                    gemini-4-argon Analysis Result
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                    {analysisResult}
                  </p>
                  {analyzeImageBase64 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          onPostToChannel({
                            content: `Photo analyzed with **gemini-4-argon**:`,
                            attachmentUrl: analyzeImageBase64,
                            attachmentAnalysis: analysisResult,
                          });
                          onClose();
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Share Photo &amp; Analysis in #{channelName}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIStudioModal;
