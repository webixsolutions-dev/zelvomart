"use client";
import {useEffect} from 'react';
import {notifyError} from '@/lib/app-errors';
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}){
 useEffect(()=>{notifyError('This page could not be loaded. Please try again.');},[]);
 return <section style={{padding:32,maxWidth:640,margin:'40px auto'}}><h2>Unable to load this page</h2><p>Please try again. Your saved information has not been changed.</p><button onClick={reset} style={{marginTop:16,padding:'10px 18px',borderRadius:8,border:0,background:'#0877ff',color:'#fff',cursor:'pointer'}}>Try again</button></section>;
}
