"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ReplayController = {
  play: (offset?: number) => void;
  pause: (offset?: number) => void;
  setConfig?: (config: Record<string, unknown>) => void;
  getCurrentTime?: () => number;
  getMetaData?: () => { totalTime?: number; startTime?: number; endTime?: number };
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  destroy?: () => void;
};

type ReplayEvent = { type?: number; timestamp?: number; [key: string]: unknown };

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function SessionReplayPlayer({ events }: { events: unknown[] }) {
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<ReplayController | null>(null);
  const timer = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [speed, setSpeed] = useState(1);

  const replayEvents = useMemo(() => {
    return (events as ReplayEvent[])
      .filter((event) => event && Number.isFinite(Number(event.timestamp)))
      .slice()
      .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  }, [events]);

  const hasFullSnapshot = replayEvents.some((event) => Number(event.type) === 2);
  const durationMs = useMemo(() => {
    if (replayEvents.length < 2) return 0;
    return Math.max(0, Number(replayEvents[replayEvents.length - 1]?.timestamp) - Number(replayEvents[0]?.timestamp));
  }, [replayEvents]);

  useEffect(() => {
    let cancelled = false;
    if (!mount.current || replayEvents.length < 2) return;

    mount.current.innerHTML = "";
    setReady(false);
    setFailed("");
    setPlaying(false);
    setCurrentMs(0);

    if (!hasFullSnapshot) {
      setFailed("This recording is missing its initial page snapshot, so it cannot be replayed. New sessions will record the initial snapshot immediately.");
      return;
    }

    import("@rrweb/replay")
      .then(({ Replayer }) => {
        if (cancelled || !mount.current) return;
        try {
          const replayer = new Replayer(replayEvents as any[], {
            root: mount.current,
            showWarning: false,
            mouseTail: true,
            skipInactive: true,
          }) as unknown as ReplayController;

          player.current = replayer;
          replayer.setConfig?.({ speed: 1 });

          // Rebuild the first full snapshot immediately. Without this the raw
          // Replayer can appear as an empty canvas until playback advances.
          replayer.pause(0);

          const meta = replayer.getMetaData?.();
          const metaDuration = Number(meta?.totalTime || 0);
          if (metaDuration > 0 && !Number.isNaN(metaDuration)) {
            // durationMs is derived from event timestamps, but the player meta
            // may be more precise. The seek bar remains safe with either value.
          }

          replayer.on?.("finish", () => {
            setPlaying(false);
            setCurrentMs(durationMs);
          });
          replayer.on?.("pause", () => setPlaying(false));
          replayer.on?.("start", () => setPlaying(true));

          // Some browser/layout combinations need one paint before the iframe
          // becomes visible. Re-seeking to zero after that paint is harmless.
          window.requestAnimationFrame(() => {
            if (!cancelled) {
              try { replayer.pause(0); } catch {}
            }
          });
          setReady(true);
        } catch (error) {
          setFailed(error instanceof Error ? error.message : "Replay could not be prepared.");
        }
      })
      .catch(() => setFailed("Replay player failed to load."));

    return () => {
      cancelled = true;
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
      try {
        player.current?.pause();
        player.current?.destroy?.();
      } catch {}
      player.current = null;
    };
  }, [replayEvents, hasFullSnapshot, durationMs]);

  useEffect(() => {
    if (!playing) {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
      return;
    }
    timer.current = window.setInterval(() => {
      const value = Number(player.current?.getCurrentTime?.() ?? currentMs);
      if (Number.isFinite(value)) setCurrentMs(Math.min(durationMs, Math.max(0, value)));
    }, 200);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [playing, durationMs]);

  if (events.length < 2) {
    return <div className="admin-card">This session does not have enough recorded events to replay yet.</div>;
  }

  const play = () => {
    if (!ready || !player.current) return;
    const startAt = currentMs >= durationMs - 100 ? 0 : currentMs;
    if (startAt === 0) setCurrentMs(0);
    try {
      player.current.play(startAt);
      setPlaying(true);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "Replay could not start.");
    }
  };

  const pause = () => {
    try {
      player.current?.pause();
      const value = Number(player.current?.getCurrentTime?.() ?? currentMs);
      if (Number.isFinite(value)) setCurrentMs(Math.min(durationMs, Math.max(0, value)));
      setPlaying(false);
    } catch {}
  };

  const restart = () => {
    if (!player.current) return;
    try {
      player.current.pause(0);
      setCurrentMs(0);
      setPlaying(false);
    } catch {}
  };

  const seek = (next: number) => {
    if (!player.current) return;
    const clamped = Math.min(durationMs, Math.max(0, next));
    const wasPlaying = playing;
    try {
      player.current.pause(clamped);
      setCurrentMs(clamped);
      if (wasPlaying) player.current.play(clamped);
    } catch {}
  };

  const changeSpeed = (next: number) => {
    setSpeed(next);
    try { player.current?.setConfig?.({ speed: next }); } catch {}
  };

  return (
    <div className="replay-player-shell replay-player-modern">
      <div className="replay-player-toolbar">
        <div className="replay-player-heading">
          <span className="replay-live-dot" aria-hidden="true" />
          <div>
            <b>Customer session</b>
            <span>{replayEvents.length} replay events · form values masked · {hasFullSnapshot ? "snapshot ready" : "snapshot missing"}</span>
          </div>
        </div>
        <div className="replay-player-actions">
          <button className="admin-btn admin-btn-light" disabled={!ready} onClick={restart}>↺ Restart</button>
          <button className="admin-btn admin-btn-light" disabled={!ready || !playing} onClick={pause}>Ⅱ Pause</button>
          <button className="admin-btn admin-btn-primary" disabled={!ready || playing} onClick={play}>▶ Play</button>
        </div>
      </div>

      <div className="replay-player-stage">
        {failed ? <div className="replay-player-error"><b>Replay unavailable</b><span>{failed}</span></div> : null}
        {!failed && !ready ? <div className="replay-player-loading"><span className="admin-spinner" /> Preparing session…</div> : null}
        <div ref={mount} className="replay-player-mount" />
      </div>

      <div className="replay-player-controls">
        <button className="replay-round-button" onClick={playing ? pause : play} disabled={!ready} aria-label={playing ? "Pause replay" : "Play replay"}>{playing ? "Ⅱ" : "▶"}</button>
        <span className="replay-time">{formatTime(currentMs)}</span>
        <input
          aria-label="Replay position"
          type="range"
          min={0}
          max={Math.max(durationMs, 1)}
          step={100}
          value={Math.min(currentMs, Math.max(durationMs, 1))}
          disabled={!ready}
          onChange={(event) => seek(Number(event.target.value))}
        />
        <span className="replay-time">{formatTime(durationMs)}</span>
        <select aria-label="Replay speed" value={speed} disabled={!ready} onChange={(event) => changeSpeed(Number(event.target.value))}>
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={1.5}>1.5×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
      </div>
    </div>
  );
}
