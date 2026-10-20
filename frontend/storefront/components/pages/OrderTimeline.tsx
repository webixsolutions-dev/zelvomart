import { CircleCheck, ClipboardCheck, House, PackageCheck, Truck } from "lucide-react";

const steps = [
  { icon: CircleCheck, title: "Order received", sub: "Your order is recorded." },
  { icon: ClipboardCheck, title: "Confirmed", sub: "We verify details with you." },
  { icon: PackageCheck, title: "Packed", sub: "Checked and packed with care." },
  { icon: Truck, title: "In transit", sub: "With our courier partner." },
  { icon: House, title: "Delivered", sub: "Pay cash on delivery." },
];

export function OrderTimeline({ step = -1 }: { step?: number }) {
  return (
    <ol className="timeline">
      {steps.map((s, i) => {
        const Icon = s.icon;
        return (
          <li key={s.title} className={i <= step ? "done" : i === step + 1 ? "next" : ""}>
            <span className="t-ico">
              <Icon size={20} />
            </span>
            <strong>{s.title}</strong>
            <small>{s.sub}</small>
          </li>
        );
      })}
    </ol>
  );
}
