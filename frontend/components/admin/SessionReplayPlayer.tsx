"use client";

import { useEffect, useRef, useState } from "react";

type ReplayController = { play:(offset?:number)=>void; pause:(offset?:number)=>void; destroy?:()=>void };

export default function SessionReplayPlayer({events}:{events:unknown[]}){
  const mount=useRef<HTMLDivElement>(null);
  const player=useRef<ReplayController|null>(null);
  const [ready,setReady]=useState(false);
  const [failed,setFailed]=useState("");

  useEffect(()=>{
    let cancelled=false;
    if(!mount.current||events.length<2) return;
    mount.current.innerHTML="";
    setReady(false); setFailed("");
    import("@rrweb/replay").then(({Replayer})=>{
      if(cancelled||!mount.current) return;
      try{
        const width=Math.min(1050,Math.max(720,mount.current.clientWidth||960));
        const replayer=new Replayer(events as any[],{root:mount.current,width,height:Math.round(width*0.59),showWarning:false,mouseTail:true});
        player.current=replayer as unknown as ReplayController;
        setReady(true);
      }catch(error){ setFailed(error instanceof Error?error.message:"Replay could not be prepared."); }
    }).catch(()=>setFailed("Replay player failed to load."));
    return()=>{cancelled=true;try{player.current?.pause();player.current?.destroy?.();}catch{}player.current=null;};
  },[events]);

  if(events.length<2) return <div className="admin-card">This session does not have enough recorded events to replay yet.</div>;
  return <div className="replay-player-shell">
    <div className="replay-player-toolbar"><div><b>Customer session</b><span>{events.length} replay events · form values masked</span></div><div className="replay-player-actions"><button className="admin-btn" disabled={!ready} onClick={()=>player.current?.pause()}>Pause</button><button className="admin-btn admin-btn-primary" disabled={!ready} onClick={()=>player.current?.play()}>▶ Play</button></div></div>
    {failed?<div className="admin-card" style={{color:'#b91c1c'}}>{failed}</div>:null}
    <div ref={mount} className="replay-player-mount" />
  </div>;
}
