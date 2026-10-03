import { HeadphonesIcon, ShieldIcon, TruckIcon, WalletIcon } from "@/components/Icons";

const items = [
  [WalletIcon, "Pay on delivery", "Cash on Delivery across Pakistan"],
  [TruckIcon, "Nationwide reach", "Reliable delivery to major cities"],
  [ShieldIcon, "Checked with care", "Products reviewed before dispatch"],
  [HeadphonesIcon, "Human support", "Real help on WhatsApp"],
] as const;

export default function TrustStrip() {
  return (
    <div className="trust-grid brand-trust-grid">
      {items.map(([Icon, title, text], index) => (
        <div className="trust-item" key={title}>
          <span className="trust-index">0{index + 1}</span>
          <span className="trust-icon"><Icon size={20} /></span>
          <div><b>{title}</b><span>{text}</span></div>
        </div>
      ))}
    </div>
  );
}
