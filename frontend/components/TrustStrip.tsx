"use client";
import {useDeliveryPolicy} from "./DeliveryPolicy";
import { ShieldIcon, TruckIcon, WalletIcon } from "@/components/Icons";

const ExchangeIcon = ({size=19}:{size?:number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7h-7a5 5 0 0 0-5 5v1"/><path d="m16 3 4 4-4 4M4 17h7a5 5 0 0 0 5-5v-1"/><path d="m8 21-4-4 4-4"/></svg>;

const items = (freeAbove:number)=>[
  [WalletIcon, "Cash on Delivery", "Pay the rider when it arrives"],
  [TruckIcon, "Free delivery", `Above Rs ${freeAbove.toLocaleString('en-US')}`],
  [ShieldIcon, "Checked before dispatch", "Every single order"],
  [ExchangeIcon, "Easy exchange", "If it doesn't match"],
] as const;

export default function TrustStrip() {
  return <div className="mock-trust-strip">{items(useDeliveryPolicy().threshold).map(([Icon,title,text])=><div key={title}><span><Icon size={19}/></span><div><b>{title}</b><small>{text}</small></div></div>)}</div>;
}
