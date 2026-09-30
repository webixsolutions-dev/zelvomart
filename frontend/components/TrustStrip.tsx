import { HeadphonesIcon, ShieldIcon, TruckIcon, WalletIcon } from "@/components/Icons";

const items = [
  [WalletIcon, "Cash on Delivery", "Pay when your parcel arrives"],
  [TruckIcon, "Nationwide Delivery", "Delivery across Pakistan"],
  [ShieldIcon, "Quality Checked", "Inspected before dispatch"],
  [HeadphonesIcon, "Real Support", "WhatsApp support from our team"],
] as const;

export default function TrustStrip() {
  return (
    <div className="trust-grid">
      {items.map(([Icon, title, text]) => (
        <div className="trust-item" key={title}>
          <span className="trust-icon"><Icon size={20} /></span>
          <div><b>{title}</b><span>{text}</span></div>
        </div>
      ))}
    </div>
  );
}
