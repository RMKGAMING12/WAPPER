import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Radio,
  Menu,
} from 'lucide-react';
import { RemotePeerStream } from '../useWebRTC';
import { VoiceChannelOccupant } from './ChannelList';

interface MediaTileProps {
  title: string;
  subtitle: string;
  stream: MediaStream | null;
  isLocal?: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  hasVideo: boolean;
  isScreenSharing: boolean;
  isSpeaking?: boolean;
  accentColor?: string;
  isFocused?: boolean;
  onToggleFocus?: () => void;
}

const MediaTile: React.FC<MediaTileProps> = ({
  title,
  subtitle,
  stream,
  isLocal = false,
  isMuted,
  isDeafened,
  hasVideo,
  isScreenSharing,
  isSpeaking = false,
  accentColor = '#6366F1',
  isFocused = false,
  onToggleFocus,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (stream && (hasVideo || isScreenSharing)) {
      videoEl.srcObject = stream;
      videoEl.play().catch(() => {});
    } else {
      videoEl.srcObject = null;
    }
  }, [stream, hasVideo, isScreenSharing]);

  const initials = title
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`relative rounded-xl bg-[#0D1322] border overflow-hidden flex flex-col items-center justify-center transition-colors min-h-[210px] ${
        isSpeaking && !isMuted
          ? 'border-emerald-400 ring-2 ring-emerald-500/30'
          : isScreenSharing
          ? 'border-sky-500/60'
          : 'border-slate-800/90'
      }`}
    >
      {/* HTML5 Video Element for Active Webcam or Screen Share */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || isDeafened}
        className={`w-full h-full object-cover ${
          stream && (hasVideo || isScreenSharing) ? 'block' : 'hidden'
        }`}
      />

      {/* Voice Avatar Fallback when Camera/Screen is Off */}
      {(!stream || (!hasVideo && !isScreenSharing)) && (
        <div className="flex flex-col items-center justify-center gap-3 p-6">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-xl transition-transform ${
              isSpeaking && !isMuted ? 'scale-105 ring-4 ring-emerald-400/50' : ''
            }`}
            style={{ backgroundColor: accentColor }}
          >
            {initials}
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-white">{title}</div>
            <div className="text-xs font-mono text-slate-400">{subtitle}</div>
          </div>
        </div>
      )}

      {/* Top Right Status & Expand Controls */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {isScreenSharing && (
          <span className="px-2 py-0.5 rounded bg-sky-500/90 text-slate-950 text-[10px] font-bold tracking-wider uppercase">
            60FPS Screen
          </span>
        )}
        {hasVideo && !isScreenSharing && (
          <span className="px-2 py-0.5 rounded bg-indigo-500/90 text-white text-[10px] font-semibold">
            HD Cam
          </span>
        )}
        {onToggleFocus && (
          <button
            type="button"
            onClick={onToggleFocus}
            aria-label={isFocused ? `Minimize ${title}` : `Maximize ${title}`}
            className="p-1.5 rounded-lg bg-slate-950/75 hover:bg-slate-900 text-slate-200 transition-colors cursor-pointer"
          >
            {isFocused ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Bottom Scrim Overlay with Username & Mic/Deafen Icons */}
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-white truncate">
            {title} {isLocal ? '(You)' : ''}
          </span>
          {isSpeaking && !isMuted && (
            <span className="text-[10px] font-mono text-emerald-300">Speaking</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isMuted ? (
            <span
              title="Microphone Muted"
              className="p-1 rounded-md bg-rose-500/25 text-rose-400 border border-rose-500/40"
            >
              <MicOff className="w-3.5 h-3.5" />
            </span>
          ) : (
            <span
              title="Microphone Active"
              className="p-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            >
              <Mic className="w-3.5 h-3.5" />
            </span>
          )}

          {isDeafened && (
            <span
              title="Audio Deafened"
              className="p-1 rounded-md bg-rose-500/25 text-rose-400 border border-rose-500/40"
            >
              <VolumeX className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

interface VoiceVideoGridProps {
  channelName: string;
  channelTopic: string;
  isJoined: boolean;
  localUser: {
    id: string;
    username: string;
    avatarUrl: string;
  };
  localStream: MediaStream | null;
  remotePeers: RemotePeerStream[];
  roomOccupants: VoiceChannelOccupant[];
  isMuted: boolean;
  isDeafened: boolean;
  hasVideo: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  mediaNotice: string | null;
  onJoinVoice: () => void;
  onLeaveVoice: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onOpenMobileNav?: () => void;
}

export const VoiceVideoGrid: React.FC<VoiceVideoGridProps> = ({
  channelName,
  channelTopic,
  isJoined,
  localUser,
  localStream,
  remotePeers,
  roomOccupants,
  isMuted,
  isDeafened,
  hasVideo,
  isScreenSharing,
  isSpeaking,
  mediaNotice,
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  onToggleDeafen,
  onToggleCamera,
  onToggleScreenShare,
  onOpenMobileNav,
}) => {
  const [focusedTileId, setFocusedTileId] = useState<string | null>(null);

  // Merge live WebRTC remotePeers with roomOccupants so all peers in the voice channel appear
  const remoteSocketIds = new Set(remotePeers.map((p) => p.socketId));
  const extraOccupants = roomOccupants.filter(
    (occ) => occ.userId !== localUser.id && !remoteSocketIds.has(occ.socketId)
  );

  return (
    <section
      aria-label={`Voice and Video Channel ${channelName}`}
      className="flex-1 bg-[#090D16] flex flex-col min-w-0 overflow-hidden"
    >
      {/* Voice Channel Top Header */}
      <header className="h-14 px-4 sm:px-5 border-b border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {onOpenMobileNav && (
            <button
              type="button"
              onClick={onOpenMobileNav}
              aria-label="Open Server and Channel Menu"
              className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white truncate">{channelName}</h2>
              <span className="text-xs text-slate-500 hidden sm:inline">·</span>
              <span className="text-xs font-mono text-emerald-400 whitespace-nowrap hidden sm:inline">
                WebRTC P2P Mesh ($0 Bandwidth)
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">{channelTopic}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono shrink-0">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span className="hidden md:inline">DTLS-SRTP Encrypted · stun.l.google.com:19302</span>
        </div>
      </header>

      {mediaNotice && (
        <div className="bg-indigo-950/60 border-b border-indigo-500/30 px-5 py-2 text-xs text-indigo-200 flex items-center justify-between">
          <span>{mediaNotice}</span>
        </div>
      )}

      {/* Main Video & Voice Tile Grid */}
      <div className="flex-1 p-5 overflow-y-auto flex flex-col justify-between gap-4">
        {!isJoined ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Radio className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Ready to join {channelName}?
              </h3>
              <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                Voice, webcam video, and 60fps screen shares flow directly browser-to-browser via
                native WebRTC RTCPeerConnection and Google public STUN servers.
              </p>
            </div>
            <button
              type="button"
              onClick={onJoinVoice}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-lg shadow-emerald-950/50"
            >
              Join P2P Voice &amp; Video Channel
            </button>
          </div>
        ) : (
          <div
            className={`grid gap-4 flex-1 ${
              focusedTileId
                ? 'grid-cols-1'
                : remotePeers.length + extraOccupants.length === 0
                ? 'grid-cols-1 max-w-2xl mx-auto w-full'
                : remotePeers.length + extraOccupants.length === 1
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
            }`}
          >
            {/* Local User Tile */}
            {(!focusedTileId || focusedTileId === 'local') && (
              <MediaTile
                title={localUser.username}
                subtitle={
                  isScreenSharing
                    ? 'Sharing Screen via WebRTC'
                    : hasVideo
                    ? 'Camera Stream Active'
                    : 'Connected · Local Peer'
                }
                stream={localStream}
                isLocal
                isMuted={isMuted}
                isDeafened={isDeafened}
                hasVideo={hasVideo}
                isScreenSharing={isScreenSharing}
                isSpeaking={isSpeaking}
                accentColor="#4F46E5"
                isFocused={focusedTileId === 'local'}
                onToggleFocus={() =>
                  setFocusedTileId((prev) => (prev === 'local' ? null : 'local'))
                }
              />
            )}

            {/* Live WebRTC Remote Peer Tiles */}
            {remotePeers.map((peer) => {
              if (focusedTileId && focusedTileId !== peer.socketId) return null;
              return (
                <MediaTile
                  key={peer.socketId}
                  title={peer.username}
                  subtitle={`P2P ${peer.connectionState.toUpperCase()} · Direct UDP`}
                  stream={peer.stream}
                  isMuted={peer.isMuted}
                  isDeafened={peer.isDeafened}
                  hasVideo={peer.hasVideo}
                  isScreenSharing={peer.isScreenSharing}
                  accentColor="#059669"
                  isFocused={focusedTileId === peer.socketId}
                  onToggleFocus={() =>
                    setFocusedTileId((prev) => (prev === peer.socketId ? null : peer.socketId))
                  }
                />
              );
            })}

            {/* Additional Pre-Connected Room Occupants */}
            {extraOccupants.map((occ) => {
              if (focusedTileId && focusedTileId !== occ.userId) return null;
              return (
                <MediaTile
                  key={occ.userId}
                  title={occ.username}
                  subtitle="P2P Mesh Peer · Ice Connected"
                  stream={null}
                  isMuted={occ.isMuted}
                  isDeafened={occ.isDeafened}
                  hasVideo={occ.hasVideo}
                  isScreenSharing={occ.isScreenSharing}
                  isSpeaking={!occ.isMuted}
                  accentColor="#0284C7"
                  isFocused={focusedTileId === occ.userId}
                  onToggleFocus={() =>
                    setFocusedTileId((prev) => (prev === occ.userId ? null : occ.userId))
                  }
                />
              );
            })}
          </div>
        )}

        {/* Bottom Floating WebRTC Media Control Dock */}
        {isJoined && (
          <div className="mx-auto flex flex-wrap items-center justify-center gap-2 px-3 sm:px-4 py-2.5 rounded-2xl bg-[#111827] border border-slate-800 shadow-2xl max-w-full">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isMuted
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isMuted ? 'Muted' : 'Mic On'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleDeafen}
              aria-label={isDeafened ? 'Undeafen Audio' : 'Deafen Audio'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isDeafened
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {isDeafened ? <VolumeX className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
              <span>{isDeafened ? 'Deafened' : 'Audio On'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleCamera}
              aria-label={hasVideo ? 'Turn Off Camera' : 'Turn On Camera'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                hasVideo
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              {hasVideo ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              <span>{hasVideo ? 'Stop Video' : 'Share Camera'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleScreenShare}
              aria-label={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isScreenSharing
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              <MonitorUp className="w-4 h-4" />
              <span>{isScreenSharing ? 'Stop Screen' : 'Share Screen'}</span>
            </button>

            <button
              type="button"
              onClick={onLeaveVoice}
              aria-label="Leave Voice Channel"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default VoiceVideoGrid;
