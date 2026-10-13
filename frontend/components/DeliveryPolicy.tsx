"use client";

import { createContext, useContext, type ReactNode } from "react";
import { resolveDeliveryPolicy, type DeliveryPolicy, type DeliverySettings } from "@/lib/shipping";

const DeliveryPolicyContext = createContext<DeliveryPolicy>(resolveDeliveryPolicy(null));

export function DeliveryPolicyProvider({
  value,
  children,
}: {
  value?: DeliverySettings | null;
  children: ReactNode;
}) {
  return <DeliveryPolicyContext.Provider value={resolveDeliveryPolicy(value)}>{children}</DeliveryPolicyContext.Provider>;
}

export function useDeliveryPolicy() {
  return useContext(DeliveryPolicyContext);
}
