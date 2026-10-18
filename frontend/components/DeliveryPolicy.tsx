"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { resolveDeliveryPolicy, type DeliveryPolicy, type DeliverySettings } from "@/lib/shipping";

const DeliveryPolicyContext = createContext<DeliveryPolicy>(resolveDeliveryPolicy(null));

export function DeliveryPolicyProvider({
  value,
  children,
}: {
  value?: DeliverySettings | null;
  children: ReactNode;
}) {
  const [policy,setPolicy]=useState(()=>resolveDeliveryPolicy(value));
  useEffect(()=>{setPolicy(resolveDeliveryPolicy(value))},[value]);
  useEffect(()=>{const update=()=>{if(document.visibilityState==='hidden')return;void fetch('/api/store-proxy/api/settings/delivery',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(data)setPolicy(resolveDeliveryPolicy(data))}).catch(()=>undefined)};const timer=setInterval(update,45000);window.addEventListener('focus',update);return()=>{clearInterval(timer);window.removeEventListener('focus',update)}},[]);
  return <DeliveryPolicyContext.Provider value={policy}>{children}</DeliveryPolicyContext.Provider>;
}

export function useDeliveryPolicy() {
  return useContext(DeliveryPolicyContext);
}
