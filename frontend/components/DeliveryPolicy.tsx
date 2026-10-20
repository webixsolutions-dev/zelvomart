"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {useSettingsRefresh} from '@/lib/settings-sync';
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
  const update=useCallback(()=>{void fetch('/api/store-proxy/api/settings/delivery',{cache:'no-store',signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():null).then(data=>{if(data)setPolicy(resolveDeliveryPolicy(data))}).catch(()=>undefined)},[]);
  useSettingsRefresh(update);
  return <DeliveryPolicyContext.Provider value={policy}>{children}</DeliveryPolicyContext.Provider>;
}

export function useDeliveryPolicy() {
  return useContext(DeliveryPolicyContext);
}
