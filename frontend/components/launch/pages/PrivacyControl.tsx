'use client';
import {useState,useEffect} from 'react';
export default function PrivacyControl(){
 const [excluded,setExcluded]=useState(false),[ready,setReady]=useState(false);
 useEffect(()=>{try{setExcluded(localStorage.getItem('zm_session_replay_opt_out')==='1');}catch{}setReady(true);},[]);
 return <div className="container section"><label><input type="checkbox" disabled={!ready} checked={excluded} onChange={e=>{try{localStorage.setItem('zm_session_replay_opt_out',e.target.checked?'1':'0');setExcluded(e.target.checked);location.reload();}catch{}}}/> Exclude this device from session recordings and optional analytics</label></div>;
}
