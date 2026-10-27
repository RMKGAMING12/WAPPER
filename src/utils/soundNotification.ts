/**
 * Web Audio API Notification Sound Engine for Wapper
 * Synthesizes a clean, soft Discord-style notification chime/ping locally
 * with zero external audio asset dependencies whenever:
 * 1. A user is mentioned (`@Username`) in a text channel, or
 * 2. A user receives a new Direct Message (DM) while looking at a different tab.
 */

export type NotificationPingKind = 'mention' | 'dm';

export interface SoundPingRecord {
  kind: NotificationPingKind;
  timestamp: number;
  count: number;
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    __wapperLastSoundPing?: SoundPingRecord;
  }
}

let sharedAudioCtx: AudioContext | null = null;
let lastPingTimestampMs = 0;
let totalPingCount = 0;

const MIN_PING_INTERVAL_MS = 320;

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtxConstructor =
    window.AudioContext || window.webkitAudioContext || null;
  if (!AudioCtxConstructor) return null;

  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    try {
      sharedAudioCtx = new AudioCtxConstructor();
    } catch {
      return null;
    }
  }
  return sharedAudioCtx;
}

/**
 * Plays a soft, clean two-tone harmonic notification ping using the Web Audio API.
 * Returns `true` if a ping was triggered (and records `__wapperLastSoundPing` on `window`).
 */
export function playNotificationPing(
  kind: NotificationPingKind = 'mention'
): boolean {
  const nowMs = Date.now();
  if (nowMs - lastPingTimestampMs < MIN_PING_INTERVAL_MS) {
    return false;
  }
  lastPingTimestampMs = nowMs;
  totalPingCount += 1;

  if (typeof window !== 'undefined') {
    window.__wapperLastSoundPing = {
      kind,
      timestamp: nowMs,
      count: totalPingCount,
    };
  }

  const ctx = getOrCreateAudioContext();
  if (!ctx) return true;

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const startTime = ctx.currentTime;
    const primaryFreq = kind === 'mention' ? 587.33 : 523.25; // D5 or C5
    const secondaryFreq = kind === 'mention' ? 880.0 : 783.99; // A5 or G5

    // Note 1: Soft warm fundamental sine wave
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(primaryFreq, startTime);
    gain1.gain.setValueAtTime(0.001, startTime);
    gain1.gain.linearRampToValueAtTime(0.11, startTime + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.0008, startTime + 0.14);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(startTime);
    osc1.stop(startTime + 0.15);

    // Note 2: Clean harmonic fifth chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(secondaryFreq, startTime + 0.075);
    gain2.gain.setValueAtTime(0.001, startTime + 0.075);
    gain2.gain.linearRampToValueAtTime(0.13, startTime + 0.095);
    gain2.gain.exponentialRampToValueAtTime(0.0005, startTime + 0.28);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(startTime + 0.075);
    osc2.stop(startTime + 0.29);
  } catch {
    // Ignore Web Audio autoplay restriction errors if browser tab has not yet received interaction
  }

  return true;
}
