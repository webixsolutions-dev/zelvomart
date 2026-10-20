"use client";
import {useEffect} from 'react';
export const SETTINGS_EVENT='zelvomart:settings-saved';
const SETTINGS_KEY='zelvomart-settings-revision';
export function notifySettingsSaved(){
  window.dispatchEvent(new Event(SETTINGS_EVENT));
  try{localStorage.setItem(SETTINGS_KEY,String(Date.now()));}catch{}
}
/** Same-browser saves update immediately; other devices refresh within 30 seconds. */
export function useSettingsRefresh(refresh:()=>void){
  useEffect(()=>{
    const update=()=>{if(document.visibilityState!=='hidden')refresh();};
    const storage=(event:StorageEvent)=>{if(event.key===SETTINGS_KEY)update();};
    const timer=setInterval(update,30000);
    window.addEventListener(SETTINGS_EVENT,update);window.addEventListener('storage',storage);window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);
    return()=>{clearInterval(timer);window.removeEventListener(SETTINGS_EVENT,update);window.removeEventListener('storage',storage);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};
  },[refresh]);
}
