import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

export interface RemotePeerStream {
  socketId: string;
  userId: string;
  username: string;
  avatarUrl: string;
  stream: MediaStream | null;
  isMuted: boolean;
  isDeafened: boolean;
  hasVideo: boolean;
  isScreenSharing: boolean;
  connectionState: RTCPeerConnectionState;
}

export interface UseWebRTCOptions {
  socket: Socket | null;
  currentUser: {
    id: string;
    username: string;
    avatarUrl: string;
  };
  isMuted: boolean;
  isDeafened: boolean;
}

/**
 * Free Public Google STUN Server Mesh for Zero-Cost ($0 Bandwidth) P2P Media Pipes
 */
export const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 8,
};

/**
 * Creates a clean synthetic canvas MediaStream when a browser or headless environment
 * lacks a physical webcam or screen-capture permission, ensuring P2P video tracks
 * can still be negotiated and previewed end-to-end.
 */
function createSyntheticVideoStream(label: string, mode: 'camera' | 'screen'): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');

  let frame = 0;
  const intervalId = window.setInterval(() => {
    if (!ctx) return;
    frame += 1;
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    if (mode === 'screen') {
      grad.addColorStop(0, '#0F172A');
      grad.addColorStop(1, '#1E293B');
    } else {
      grad.addColorStop(0, '#1E1B4B');
      grad.addColorStop(1, '#0F172A');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Animated waveform bar
    ctx.strokeStyle = mode === 'screen' ? '#38BDF8' : '#818CF8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 180; x <= canvas.width - 180; x += 6) {
      const y =
        canvas.height / 2 +
        Math.sin((x + frame * 4) * 0.04) * 28 * Math.cos(frame * 0.05);
      if (x === 180) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '600 14px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      mode === 'screen' ? `${label} · 60fps Screen` : `${label} · P2P HD Cam`,
      canvas.width / 2,
      canvas.height - 46
    );
    ctx.fillStyle = '#94A3B8';
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillText('stun.l.google.com:19302', canvas.width / 2, canvas.height - 26);
  }, 100);

  const stream = canvas.captureStream(15);
  stream.getVideoTracks().forEach((track) => {
    track.addEventListener('ended', () => {
      window.clearInterval(intervalId);
    });
  });
  return stream;
}

export function useWebRTC({ socket, currentUser, isMuted, isDeafened }: UseWebRTCOptions) {
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hasVideo, setHasVideo] = useState<boolean>(false);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [remotePeers, setRemotePeers] = useState<RemotePeerStream[]>([]);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeChannelRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadIntervalRef = useRef<number | null>(null);

  // Sync mute state to local audio tracks
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted && !isDeafened;
      });
    }
    if (activeChannelRef.current && socket) {
      socket.emit('voice-media-state', {
        channelId: activeChannelRef.current,
        isMuted,
        isDeafened,
        hasVideo,
        isScreenSharing,
      });
    }
  }, [isMuted, isDeafened, hasVideo, isScreenSharing, socket]);

  const stopVoiceActivityDetector = useCallback(() => {
    if (vadIntervalRef.current !== null) {
      window.clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const startVoiceActivityDetector = useCallback(
    (stream: MediaStream) => {
      stopVoiceActivityDetector();
      if (stream.getAudioTracks().length === 0) return;
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        vadIntervalRef.current = window.setInterval(() => {
          if (isMuted || isDeafened) {
            setIsSpeaking(false);
            return;
          }
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setIsSpeaking(avg > 14);
        }, 150);
      } catch {
        // Ignore AudioContext restrictions if autoplay policy blocks
      }
    },
    [isMuted, isDeafened, stopVoiceActivityDetector]
  );

  const createOrGetPeerConnection = useCallback(
    (
      remoteSocketId: string,
      channelId: string,
      peerMeta: {
        userId: string;
        username: string;
        avatarUrl: string;
        isMuted?: boolean;
        isDeafened?: boolean;
        hasVideo?: boolean;
        isScreenSharing?: boolean;
      }
    ): RTCPeerConnection => {
      const existingPc = peerConnectionsRef.current.get(remoteSocketId);
      if (existingPc) return existingPc;

      const pc = new RTCPeerConnection(RTC_CONFIGURATION);
      peerConnectionsRef.current.set(remoteSocketId, pc);

      // Attach all local media tracks to the new RTCPeerConnection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          if (localStreamRef.current) {
            pc.addTrack(track, localStreamRef.current);
          }
        });
      }

      // Relay trickled ICE candidates to remote peer via Socket.io
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', {
            targetSocketId: remoteSocketId,
            candidate: event.candidate.toJSON(),
            channelId,
          });
        }
      };

      // Dynamically bind remote tracks into RemotePeerStream state
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        setRemotePeers((prev) => {
          const exists = prev.some((p) => p.socketId === remoteSocketId);
          if (exists) {
            return prev.map((p) =>
              p.socketId === remoteSocketId ? { ...p, stream: remoteStream || p.stream } : p
            );
          }
          return [
            ...prev,
            {
              socketId: remoteSocketId,
              userId: peerMeta.userId,
              username: peerMeta.username,
              avatarUrl: peerMeta.avatarUrl,
              stream: remoteStream || null,
              isMuted: Boolean(peerMeta.isMuted),
              isDeafened: Boolean(peerMeta.isDeafened),
              hasVideo: Boolean(peerMeta.hasVideo),
              isScreenSharing: Boolean(peerMeta.isScreenSharing),
              connectionState: pc.connectionState,
            },
          ];
        });
      };

      pc.onconnectionstatechange = () => {
        setRemotePeers((prev) =>
          prev.map((p) =>
            p.socketId === remoteSocketId ? { ...p, connectionState: pc.connectionState } : p
          )
        );
      };

      // Ensure peer entry exists even before tracks arrive
      setRemotePeers((prev) => {
        if (prev.some((p) => p.socketId === remoteSocketId)) return prev;
        return [
          ...prev,
          {
            socketId: remoteSocketId,
            userId: peerMeta.userId,
            username: peerMeta.username,
            avatarUrl: peerMeta.avatarUrl,
            stream: null,
            isMuted: Boolean(peerMeta.isMuted),
            isDeafened: Boolean(peerMeta.isDeafened),
            hasVideo: Boolean(peerMeta.hasVideo),
            isScreenSharing: Boolean(peerMeta.isScreenSharing),
            connectionState: pc.connectionState,
          },
        ];
      });

      return pc;
    },
    [socket]
  );

  // Join a Voice Channel and initialize local media + P2P mesh
  const joinVoiceChannel = useCallback(
    async (channelId: string) => {
      if (!socket) return;

      // Clean up any previous connections
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      pendingCandidatesRef.current.clear();
      setRemotePeers([]);
      setMediaNotice(null);

      let acquiredStream: MediaStream | null = null;
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          acquiredStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
        }
      } catch {
        setMediaNotice(
          'Microphone hardware unavailable in this browser tab — connected in P2P listen/synthetic mode.'
        );
      }

      if (!acquiredStream) {
        acquiredStream = new MediaStream();
      }

      acquiredStream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted && !isDeafened;
      });

      localStreamRef.current = acquiredStream;
      setLocalStream(acquiredStream);
      setHasVideo(false);
      setIsScreenSharing(false);
      activeChannelRef.current = channelId;
      setActiveVoiceChannelId(channelId);

      startVoiceActivityDetector(acquiredStream);

      socket.emit('join-voice-channel', {
        userId: currentUser.id,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
        channelId,
        isMuted,
        isDeafened,
        hasVideo: false,
        isScreenSharing: false,
      });
    },
    [socket, currentUser, isMuted, isDeafened, startVoiceActivityDetector]
  );

  // Leave active Voice Channel and tear down all P2P connections
  const leaveVoiceChannel = useCallback(() => {
    const channelId = activeChannelRef.current;
    if (socket && channelId) {
      socket.emit('leave-voice-channel', {
        channelId,
        userId: currentUser.id,
      });
    }

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    stopVoiceActivityDetector();
    activeChannelRef.current = null;
    setActiveVoiceChannelId(null);
    setLocalStream(null);
    setHasVideo(false);
    setIsScreenSharing(false);
    setRemotePeers([]);
    setMediaNotice(null);
  }, [socket, currentUser.id, stopVoiceActivityDetector]);

  // Replace or attach video track across all active RTCPeerConnections
  const replaceOrAttachVideoTrack = useCallback(async (newVideoTrack: MediaStreamTrack | null) => {
    const currentStream = localStreamRef.current || new MediaStream();

    // Stop and remove existing video tracks
    currentStream.getVideoTracks().forEach((oldTrack) => {
      oldTrack.stop();
      currentStream.removeTrack(oldTrack);
    });

    if (newVideoTrack) {
      currentStream.addTrack(newVideoTrack);
    }

    localStreamRef.current = currentStream;
    setLocalStream(new MediaStream(currentStream.getTracks()));

    // Update all active peer connections
    for (const [, pc] of peerConnectionsRef.current.entries()) {
      const videoSender = pc
        .getSenders()
        .find((sender) => sender.track && sender.track.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(newVideoTrack);
      } else if (newVideoTrack) {
        pc.addTrack(newVideoTrack, currentStream);
      }
    }
  }, []);

  // Toggle Webcam Video
  const toggleCamera = useCallback(async () => {
    if (!activeChannelRef.current) return;

    if (hasVideo) {
      await replaceOrAttachVideoTrack(null);
      setHasVideo(false);
      return;
    }

    setIsScreenSharing(false);
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      });
      const videoTrack = camStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          setHasVideo(false);
          replaceOrAttachVideoTrack(null);
        };
        await replaceOrAttachVideoTrack(videoTrack);
        setHasVideo(true);
      }
    } catch {
      // Fallback to synthetic P2P camera stream so user can test video grid without hardware camera
      const synthStream = createSyntheticVideoStream(currentUser.username, 'camera');
      const synthTrack = synthStream.getVideoTracks()[0];
      if (synthTrack) {
        await replaceOrAttachVideoTrack(synthTrack);
        setHasVideo(true);
        setMediaNotice('Using synthetic P2P camera feed (no physical webcam detected).');
      }
    }
  }, [hasVideo, currentUser.username, replaceOrAttachVideoTrack]);

  // Toggle Browser Screen Share
  const toggleScreenShare = useCallback(async () => {
    if (!activeChannelRef.current) return;

    if (isScreenSharing) {
      await replaceOrAttachVideoTrack(null);
      setIsScreenSharing(false);
      return;
    }

    setHasVideo(false);
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 60 } },
        audio: false,
      });
      const screenTrack = displayStream.getVideoTracks()[0];
      if (screenTrack) {
        screenTrack.onended = () => {
          setIsScreenSharing(false);
          replaceOrAttachVideoTrack(null);
        };
        await replaceOrAttachVideoTrack(screenTrack);
        setIsScreenSharing(true);
      }
    } catch {
      const synthStream = createSyntheticVideoStream(currentUser.username, 'screen');
      const synthTrack = synthStream.getVideoTracks()[0];
      if (synthTrack) {
        await replaceOrAttachVideoTrack(synthTrack);
        setIsScreenSharing(true);
        setMediaNotice('Streaming synthetic P2P screen capture.');
      }
    }
  }, [isScreenSharing, currentUser.username, replaceOrAttachVideoTrack]);

  // Socket.io WebRTC Signaling Event Listeners
  useEffect(() => {
    if (!socket) return;

    const handleVoiceRoomPeers = async (payload: {
      channelId: string;
      peers: Array<{
        socketId: string;
        userId: string;
        username: string;
        avatarUrl: string;
        isMuted: boolean;
        isDeafened: boolean;
        hasVideo: boolean;
        isScreenSharing: boolean;
      }>;
    }) => {
      if (payload.channelId !== activeChannelRef.current) return;

      for (const peer of payload.peers) {
        if (peer.socketId === socket.id) continue;
        const pc = createOrGetPeerConnection(peer.socketId, payload.channelId, peer);
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);
          socket.emit('webrtc-offer', {
            targetSocketId: peer.socketId,
            sdp: pc.localDescription,
            channelId: payload.channelId,
            fromUser: {
              userId: currentUser.id,
              username: currentUser.username,
              avatarUrl: currentUser.avatarUrl,
            },
          });
        } catch (err) {
          console.error('[Wapper WebRTC] Failed creating offer:', err);
        }
      }
    };

    const handlePeerJoined = (peer: {
      socketId: string;
      userId: string;
      username: string;
      avatarUrl: string;
      channelId: string;
      isMuted: boolean;
      isDeafened: boolean;
      hasVideo: boolean;
      isScreenSharing: boolean;
    }) => {
      if (peer.channelId !== activeChannelRef.current || peer.socketId === socket.id) return;
      createOrGetPeerConnection(peer.socketId, peer.channelId, peer);
    };

    const handleWebRTCOffer = async (payload: {
      fromSocketId: string;
      sdp: RTCSessionDescriptionInit;
      channelId: string;
      fromUser: { userId: string; username: string; avatarUrl: string };
    }) => {
      if (payload.channelId !== activeChannelRef.current) return;
      const pc = createOrGetPeerConnection(payload.fromSocketId, payload.channelId, payload.fromUser);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const queued = pendingCandidatesRef.current.get(payload.fromSocketId) || [];
        for (const candidate of queued) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidatesRef.current.delete(payload.fromSocketId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', {
          targetSocketId: payload.fromSocketId,
          sdp: pc.localDescription,
          channelId: payload.channelId,
        });
      } catch (err) {
        console.error('[Wapper WebRTC] Error handling offer:', err);
      }
    };

    const handleWebRTCAnswer = async (payload: {
      fromSocketId: string;
      sdp: RTCSessionDescriptionInit;
      channelId: string;
    }) => {
      if (payload.channelId !== activeChannelRef.current) return;
      const pc = peerConnectionsRef.current.get(payload.fromSocketId);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const queued = pendingCandidatesRef.current.get(payload.fromSocketId) || [];
        for (const candidate of queued) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidatesRef.current.delete(payload.fromSocketId);
      } catch (err) {
        console.error('[Wapper WebRTC] Error handling answer:', err);
      }
    };

    const handleIceCandidate = async (payload: {
      fromSocketId: string;
      candidate: RTCIceCandidateInit;
      channelId: string;
    }) => {
      if (payload.channelId !== activeChannelRef.current) return;
      const pc = peerConnectionsRef.current.get(payload.fromSocketId);
      if (!pc || !pc.remoteDescription) {
        const list = pendingCandidatesRef.current.get(payload.fromSocketId) || [];
        list.push(payload.candidate);
        pendingCandidatesRef.current.set(payload.fromSocketId, list);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (err) {
        console.error('[Wapper WebRTC] Error adding ICE candidate:', err);
      }
    };

    const handlePeerUpdated = (peer: {
      socketId: string;
      isMuted: boolean;
      isDeafened: boolean;
      hasVideo: boolean;
      isScreenSharing: boolean;
    }) => {
      setRemotePeers((prev) =>
        prev.map((p) =>
          p.socketId === peer.socketId
            ? {
                ...p,
                isMuted: peer.isMuted,
                isDeafened: peer.isDeafened,
                hasVideo: peer.hasVideo,
                isScreenSharing: peer.isScreenSharing,
              }
            : p
        )
      );
    };

    const handlePeerLeft = (payload: { socketId: string }) => {
      const pc = peerConnectionsRef.current.get(payload.socketId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(payload.socketId);
      }
      pendingCandidatesRef.current.delete(payload.socketId);
      setRemotePeers((prev) => prev.filter((p) => p.socketId !== payload.socketId));
    };

    socket.on('voice-room-peers', handleVoiceRoomPeers);
    socket.on('voice-peer-joined', handlePeerJoined);
    socket.on('webrtc-offer', handleWebRTCOffer);
    socket.on('webrtc-answer', handleWebRTCAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('voice-peer-updated', handlePeerUpdated);
    socket.on('voice-peer-left', handlePeerLeft);

    return () => {
      socket.off('voice-room-peers', handleVoiceRoomPeers);
      socket.off('voice-peer-joined', handlePeerJoined);
      socket.off('webrtc-offer', handleWebRTCOffer);
      socket.off('webrtc-answer', handleWebRTCAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('voice-peer-updated', handlePeerUpdated);
      socket.off('voice-peer-left', handlePeerLeft);
    };
  }, [socket, currentUser, createOrGetPeerConnection]);

  return {
    activeVoiceChannelId,
    localStream,
    remotePeers,
    hasVideo,
    isScreenSharing,
    isSpeaking,
    mediaNotice,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleCamera,
    toggleScreenShare,
  };
}
