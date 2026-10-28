import React, { useEffect, useState } from 'react';
import { Gamepad2, Clock } from 'lucide-react';
import {
  RichPresenceActivity,
  isRichPresenceActive,
  formatRichPresenceElapsed,
  RICH_PRESENCE_ASSET_PRESETS,
} from '../utils/chatLogic';

interface RichPresenceCardProps {
  richPresence?: RichPresenceActivity | null;
  variant?: 'sidebar' | 'friends' | 'popover';
  accentColor?: string;
}

export const RichPresenceCard: React.FC<RichPresenceCardProps> = ({
  richPresence,
  variant = 'popover',
  accentColor = '#5865F2',
}) => {
  const active = isRichPresenceActive(richPresence);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!active || !richPresence?.startedAt) return;
    setNowMs(Date.now());
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [active, richPresence?.startedAt]);

  if (!active || !richPresence) return null;

  const elapsedLabel = formatRichPresenceElapsed(richPresence.startedAt, nowMs);
  const assetSrc = richPresence.assetUrl || RICH_PRESENCE_ASSET_PRESETS[0].assetUrl;

  if (variant === 'sidebar') {
    return (
      <div
        data-testid="rich-presence-sidebar-card"
        className="mt-1.5 flex items-start gap-2 rounded-lg bg-slate-900/90 border border-indigo-500/25 px-2 py-1.5 shadow-sm"
      >
        <div className="relative w-7 h-7 rounded-md bg-slate-800 border border-slate-700/80 flex items-center justify-center shrink-0 overflow-hidden">
          {assetSrc ? (
            <img
              src={assetSrc}
              alt={richPresence.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <Gamepad2 className="w-3.5 h-3.5 text-indigo-400" />
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-slate-950" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[11px] font-bold text-slate-100 truncate">
            {richPresence.name}
          </div>
          {richPresence.details && (
            <div className="text-[10px] text-slate-300 truncate">
              {richPresence.details}
            </div>
          )}
          {richPresence.state && (
            <div className="text-[10px] text-slate-400 truncate">
              {richPresence.state}
            </div>
          )}
          {elapsedLabel && (
            <div
              data-testid="rich-presence-live-timer"
              className="mt-0.5 flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-400 tabular-nums"
            >
              <Clock className="w-2.5 h-2.5 shrink-0" />
              <span>{elapsedLabel}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'friends') {
    return (
      <div
        data-testid="rich-presence-friends-card"
        className="mt-1.5 inline-flex items-center gap-2.5 rounded-xl bg-slate-950/90 border border-indigo-500/30 px-2.5 py-1.5 max-w-full"
      >
        <div className="relative w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center shrink-0 overflow-hidden">
          {assetSrc ? (
            <img
              src={assetSrc}
              alt={richPresence.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <Gamepad2 className="w-4 h-4 text-indigo-400" />
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-slate-950" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-white truncate">
              {richPresence.name}
            </span>
            {elapsedLabel && (
              <span
                data-testid="rich-presence-live-timer"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono font-semibold text-emerald-300 tabular-nums"
              >
                <Clock className="w-2.5 h-2.5 shrink-0" />
                {elapsedLabel}
              </span>
            )}
          </div>
          {(richPresence.details || richPresence.state) && (
            <div className="text-[11px] text-slate-300 truncate mt-0.5">
              {[richPresence.details, richPresence.state].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="rich-presence-popover-card"
      className="rounded-xl bg-slate-900/90 border border-slate-800/90 p-3 space-y-2 shadow-inner"
      style={{ borderColor: `${accentColor}44` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
          <Gamepad2 className="w-3.5 h-3.5 text-indigo-400" />
          Activity Status
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          Active Now
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center shrink-0 overflow-hidden shadow-md">
          {assetSrc ? (
            <img
              src={assetSrc}
              alt={richPresence.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <Gamepad2 className="w-6 h-6 text-indigo-400" />
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
        </div>

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-xs font-bold text-white truncate">
            {richPresence.name}
          </div>
          {richPresence.details && (
            <div className="text-[11px] text-slate-300 truncate">
              {richPresence.details}
            </div>
          )}
          {richPresence.state && (
            <div className="text-[11px] text-slate-400 truncate">
              {richPresence.state}
            </div>
          )}
          {elapsedLabel && (
            <div
              data-testid="rich-presence-live-timer"
              className="pt-0.5 flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-400 tabular-nums"
            >
              <Clock className="w-3 h-3 shrink-0" />
              <span>{elapsedLabel}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
