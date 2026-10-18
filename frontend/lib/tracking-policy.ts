"use client";
import {storefrontHosts} from './site-url';
export function staffDevice(){
 try{return !!localStorage.getItem('zelvomart_admin_user')||!!localStorage.getItem('zelvomart_admin_token')||localStorage.getItem('zm_session_replay_opt_out')==='1'}catch{return false}
}
export function adsAllowed(){return typeof window!=='undefined'&&window.location.protocol==='https:'&&storefrontHosts().includes(window.location.hostname)&&!window.location.pathname.startsWith('/admin')&&!staffDevice()}
