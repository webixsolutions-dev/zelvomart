"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {ReplaySkeleton} from './ReplayStatCards';
import {REPLAY_SKIP_IDLE_MS,REPLAY_VISIBILITY_RULES,replayStartOffset,replayActivityOffsets,replaySkipTarget} from '@/lib/replay-timing';

type ReplayController = {
  play: (offset?: number) => void;
  addEvent?:(event:any)=>void;
  startLive?:(timestamp?:number)=>void;
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

export default function SessionReplayPlayer({ events,loading=false,live=false,waiting=false,seekTo }: { events: unknown[];loading?:boolean;live?:boolean;waiting?:boolean;seekTo?:number }) {
  const shell=useRef<HTMLDivElement>(null);
  const stage=useRef<HTMLDivElement>(null);
  const appended=useRef(new WeakSet<object>());
  const latest=useRef<unknown[]>(events);
  const [skipInactive,setSkipInactive]=useState(true);
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<ReplayController | null>(null);
  const timer = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [playerVersion,setPlayerVersion]=useState(0);
  const [fullscreen,setFullscreen]=useState(false);
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>{const update=()=>setFullscreen(document.fullscreenElement===shell.current);const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setExpanded(false)};document.addEventListener('fullscreenchange',update);window.addEventListener('keydown',escape);return()=>{document.removeEventListener('fullscreenchange',update);window.removeEventListener('keydown',escape)}},[]);
  const [failed, setFailed] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [livePaused,setLivePaused]=useState(false);
  const pausedOffset=useRef(0);
  const autoStarted=useRef(false);

  const replayEvents = useMemo(() => {
    return (events as ReplayEvent[])
      .filter((event) => event && Number.isFinite(Number(event.timestamp)))
      .slice()
      .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  }, [events]);
  latest.current=replayEvents;
  const activityOffsets=useMemo(()=>replayActivityOffsets(replayEvents),[replayEvents]);

  const hasFullSnapshot = replayEvents.some((event) => Number(event.type) === 2);
  const startOffset=replayStartOffset(replayEvents);
  const durationMs = useMemo(() => {
    if (replayEvents.length < 2) return 0;
    return Math.max(0, Number(replayEvents[replayEvents.length - 1]?.timestamp) - Number(replayEvents[0]?.timestamp));
  }, [replayEvents]);
  const durationRef=useRef(durationMs);durationRef.current=durationMs;

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
          const replayer = new Replayer(latest.current as any[], {
            root: mount.current,
            liveMode:live&&!livePaused,
            // Delayed live batches must update the iframe immediately, including
            // events older than the live buffer that rrweb casts synchronously.
            useVirtualDom:!(live&&!livePaused),
            showWarning: false,
            mouseTail: true,
            insertStyleRules:REPLAY_VISIBILITY_RULES,
            skipInactive: true,
            inactivePeriodThreshold:REPLAY_SKIP_IDLE_MS,
          }) as unknown as ReplayController;

          player.current = replayer;
          appended.current=new WeakSet(latest.current as object[]);
          replayer.setConfig?.({ speed,skipInactive });

          // Rebuild the first full snapshot immediately. Without this the raw
          // Replayer can appear as an empty canvas until playback advances.
          if(live&&!livePaused){replayer.pause(durationRef.current+1);replayer.startLive?.(Date.now()-10000);setPlaying(true);}else{const offset=livePaused?pausedOffset.current:replayStartOffset(latest.current as ReplayEvent[]);replayer.pause(offset);setCurrentMs(offset);}

          const meta = replayer.getMetaData?.();
          const metaDuration = Number(meta?.totalTime || 0);
          if (metaDuration > 0 && !Number.isNaN(metaDuration)) {
            // durationMs is derived from event timestamps, but the player meta
            // may be more precise. The seek bar remains safe with either value.
          }

          replayer.on?.("finish", () => {
            setPlaying(false);
            setCurrentMs(durationRef.current);
          });
          replayer.on?.("pause", () => setPlaying(false));
          replayer.on?.("start", () => setPlaying(true));

          // Some browser/layout combinations need one paint before the iframe
          // becomes visible. Re-seeking to zero after that paint is harmless.
          window.requestAnimationFrame(() => {
            if (!cancelled && !autoStarted.current && (!live||livePaused)) {
              try { replayer.pause(livePaused?pausedOffset.current:replayStartOffset(latest.current as ReplayEvent[])); } catch {}
            }
          });
          setReady(true);
          setPlayerVersion(n=>n+1);
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
  }, [hasFullSnapshot,replayEvents.length>=2,live,livePaused]);

  useEffect(() => {
    if (!playing) {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
      return;
    }
    timer.current = window.setInterval(() => {
      const value = Number(player.current?.getCurrentTime?.() ?? currentMs);
      if(skipInactive&&!live){const target=replaySkipTarget(activityOffsets,value);if(target!==null){player.current?.pause(target);player.current?.play(target);setCurrentMs(target);return;}}
      if (Number.isFinite(value)) setCurrentMs(Math.min(durationMs, Math.max(0, value)));
    }, 200);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [playing, durationMs,skipInactive,live,activityOffsets]);

  useEffect(()=>{if(!ready||!player.current)return;try{for(const event of replayEvents){if(appended.current.has(event))continue;player.current.addEvent?.(event);appended.current.add(event);}}catch{setFailed('A recording update could not be applied. Retry this recording.')}},[replayEvents,ready]);
  useEffect(()=>{if(!ready||loading||live||autoStarted.current||!player.current)return;try{player.current.play(startOffset);setCurrentMs(startOffset);autoStarted.current=true;setPlaying(true);}catch{setFailed('Automatic playback could not start. Please select Play.')}},[ready,loading,live,startOffset]);
  useEffect(()=>{if(!ready)return;const fit=()=>{const wrapper=mount.current?.querySelector<HTMLElement>('.replayer-wrapper'),frame=mount.current?.querySelector<HTMLIFrameElement>('iframe'),container=stage.current;if(!wrapper||!frame||!container)return;const width=Number(frame.getAttribute('width'))||frame.offsetWidth||1280,height=Number(frame.getAttribute('height'))||frame.offsetHeight||720;const mobile=width<768;const margin=mobile?32:0;const scale=Math.max(0.001,Math.min((container.clientWidth-margin)/width,(container.clientHeight-margin)/height));wrapper.style.outline=mobile?'10px solid #17243a':'none';wrapper.style.borderRadius=mobile?'22px':'0';wrapper.style.overflow='hidden';wrapper.style.width=`${width}px`;wrapper.style.height=`${height}px`;wrapper.style.position='absolute';wrapper.style.transformOrigin='top left';wrapper.style.transform=`scale(${scale})`;wrapper.style.left=`${(container.clientWidth-width*scale)/2}px`;wrapper.style.top=`${(container.clientHeight-height*scale)/2}px`;};const observer=new ResizeObserver(fit);if(stage.current)observer.observe(stage.current);player.current?.on?.('resize',fit);fit();return()=>observer.disconnect()},[ready,playerVersion]);
  useEffect(()=>{if(seekTo===undefined||!ready||!player.current)return;const value=Math.max(0,Math.min(durationMs,seekTo));if(live&&!livePaused){pausedOffset.current=value;setLivePaused(true);}else player.current.pause(value);setCurrentMs(value);setPlaying(false)},[seekTo,ready]);

  if(events.length<2||!hasFullSnapshot){return loading||waiting?<div className="replay-loading-shell" role="status" aria-label={waiting?'Waiting for visitor activity':'Loading recording'} aria-busy="true"><ReplaySkeleton className="replay-loading-bar"/><ReplaySkeleton className="replay-loading-screen"/><ReplaySkeleton className="replay-loading-controls"/></div>:<div className="admin-card" role="status">This recording has no page snapshot and cannot be played.</div>}

  const play = () => {
    if (!ready || !player.current) return;
    const startAt = currentMs >= durationMs - 100 ? startOffset : Math.max(startOffset,currentMs);
    if (startAt === 0) setCurrentMs(0);
    try {
      if(live){setLivePaused(false);return;}else player.current.play(startAt);
      setPlaying(true);
    } catch (error) {
      setFailed(error instanceof Error ? error.message : "Replay could not start.");
    }
  };

  const pause = () => {
    try {
      if(live){pausedOffset.current=Number(player.current?.getCurrentTime?.()??currentMs);setLivePaused(true);setPlaying(false);return;}
      player.current?.pause();
      const value = Number(player.current?.getCurrentTime?.() ?? currentMs);
      if (Number.isFinite(value)) setCurrentMs(Math.min(durationMs, Math.max(0, value)));
      setPlaying(false);
    } catch {}
  };

  const restart = () => {
    if (!player.current) return;
    try {
      player.current.pause(startOffset);
      setCurrentMs(startOffset);
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
    <div ref={shell} className={`replay-player-shell replay-player-modern${expanded?' replay-expanded':''}`}>
      <div className="replay-player-toolbar">
        <div className="replay-player-heading">
          <span className={live&&!livePaused?'replay-live-dot':'replay-recorded-dot'} aria-hidden="true" />
          <div>
            <b>{live?'Live session':'Session recording'}</b>
            <span>Full visitor viewport · private inputs masked</span>
          </div>
        </div>
        <div className="replay-player-actions">
          <button className="admin-btn admin-btn-light" onClick={()=>{if(document.fullscreenElement){void document.exitFullscreen();return;}if(expanded){setExpanded(false);return;}if(shell.current?.requestFullscreen)void shell.current.requestFullscreen().catch(()=>setExpanded(true));else setExpanded(true);}}>{fullscreen||expanded?'Exit fullscreen':'⛶ Fullscreen'}</button>
          <button className="admin-btn admin-btn-light" disabled={!ready||live} onClick={restart}>↺ Restart</button>
          <button className="admin-btn admin-btn-light" disabled={!ready || !playing} onClick={pause}>Ⅱ Pause</button>
          <button className="admin-btn admin-btn-primary" disabled={!ready || playing} onClick={play}>▶ Play</button>
        </div>
      </div>

      <div ref={stage} className="replay-player-stage">
        {failed ? <div className="replay-player-error"><b>Replay unavailable</b><span>{failed}</span></div> : null}
        {!failed && !ready ? <div className="replay-player-loading" role="status" aria-label="Preparing recording"><ReplaySkeleton className="replay-loading-screen"/></div> : null}
        <div ref={mount} className="replay-player-mount" />
      </div>

      <label className="replay-inactive"><input type="checkbox" checked={skipInactive} onChange={e=>{setSkipInactive(e.target.checked);player.current?.setConfig?.({skipInactive:e.target.checked})}}/> Skip inactive time <span>Gaps over 10 seconds{live?' · Live view':''}</span></label>
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
          disabled={!ready||live}
          onChange={(event) => seek(Number(event.target.value))}
        />
        <span className="replay-time">{formatTime(durationMs)}</span>
        <select aria-label="Replay speed" value={speed} disabled={!ready} onChange={(event) => changeSpeed(Number(event.target.value))}>
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={1.5}>1.5×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
          <option value={8}>8×</option>
        </select>
      </div>
    </div>
  );
}
