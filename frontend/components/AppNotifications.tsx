"use client";
import {useEffect} from 'react';
import {ToastContainer} from 'react-toastify';
import {notifyError,userFacingRequest} from '@/lib/app-errors';
import 'react-toastify/dist/ReactToastify.css';

export default function AppNotifications(){
 useEffect(()=>{
  const original=window.fetch;
  const wrapped:typeof fetch=async(input,init)=>{
   const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
   const report=userFacingRequest(url);
   try{const response=await original.call(window,input,init);if(report&&!response.ok){void response.clone().json().catch(()=>null).then(body=>notifyError(body?.message||body?.error||'',response.status));}return response;}
   catch(error){if(report&&!init?.signal?.aborted&&!(input instanceof Request&&input.signal.aborted))notifyError(error);throw error;}
  };
  window.fetch=wrapped;
  const rejected=(event:PromiseRejectionEvent)=>notifyError(event.reason);
  const failed=(event:ErrorEvent)=>{if(event.error)notifyError('An unexpected error occurred. Please try again or refresh the page.');};
  window.addEventListener('unhandledrejection',rejected);window.addEventListener('error',failed);
  return()=>{if(window.fetch===wrapped)window.fetch=original;window.removeEventListener('unhandledrejection',rejected);window.removeEventListener('error',failed);};
 },[]);
 return <ToastContainer position="top-right" autoClose={5000} limit={3} newestOnTop closeOnClick pauseOnHover pauseOnFocusLoss theme="light" style={{zIndex:999999,fontFamily:'inherit',fontSize:13}}/>;
}
