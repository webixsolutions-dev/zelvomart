"use client";
import {useCallback,useEffect,useRef} from 'react';
import {useRouter} from 'next/navigation';
import {useSettingsRefresh} from '@/lib/settings-sync';
import {setLiveTrackingSettings} from '@/lib/tracking-policy';
const keys='store.info,store.delivery,store.bundleDefaultDiscountPercent,tracking.metaPixelEnabled,tracking.metaPixelId,tracking.tiktokPixelEnabled,tracking.tiktokPixelId,tracking.sessionReplayEnabled,tracking.sessionReplayRetentionDays';
export default function StoreSettingsSync(){
  const router=useRouter(),previous=useRef<string|null>(null),running=useRef(false);
  const refresh=useCallback(async()=>{
    if(running.current)return;running.current=true;
    try{const response=await fetch('/api/store-proxy/api/settings/public?keys='+encodeURIComponent(keys),{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)return;const settings=await response.json();setLiveTrackingSettings(settings);const next=JSON.stringify(Object.fromEntries(Object.entries(settings).sort(([a],[b])=>a.localeCompare(b))));if(previous.current!==null&&previous.current!==next){const old=JSON.parse(previous.current);if(['tracking.metaPixelId','tracking.tiktokPixelId','tracking.metaPixelEnabled','tracking.tiktokPixelEnabled'].some(key=>old[key]!==settings[key])){location.reload();return;}router.refresh();}previous.current=next;}catch{}finally{running.current=false;}
  },[router]);
  useEffect(()=>{void refresh();},[refresh]);useSettingsRefresh(refresh);return null;
}
