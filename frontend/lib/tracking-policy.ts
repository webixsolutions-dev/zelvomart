"use client";
import {storefrontHosts} from './site-url';
let liveSettings:Record<string,unknown>={};
export function setLiveTrackingSettings(settings:Record<string,unknown>){liveSettings=settings;}
export function trackingSettingEnabled(key:string){return liveSettings[key]!==false&&liveSettings[key]!=='false';}
export function staffDevice(){
 try{return !!localStorage.getItem('zelvomart_admin_user')||!!localStorage.getItem('zelvomart_admin_token')||localStorage.getItem('zm_session_replay_opt_out')==='1'}catch{return false}
}
export function adsAllowed(){return typeof window!=='undefined'&&window.location.protocol==='https:'&&storefrontHosts().includes(window.location.hostname)&&!window.location.pathname.startsWith('/admin')&&!staffDevice()}
