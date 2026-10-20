import { ChevronDown } from "lucide-react";

const points = [
  { title: "Checked before dispatch", text: "Every item is inspected and packed with care before it leaves our stock." },
  { title: "Cash on Delivery", text: "Pay in cash when your parcel arrives, anywhere in Pakistan." },
  { title: "Need help choosing?", text: "Message us on WhatsApp with the product name and we’ll help you pick." },
];

/** "About the collection" block under every category and listing grid. */
export function CollectionAbout({ name, text }: { name: string; text: string }) {
  return (
    <section className="collection-about" aria-labelledby="collection-about-title">
      <div className="collection-about-copy">
        <span className="eyebrow">About the collection</span>
        <h2 id="collection-about-title">Why shop {name} at Zelvomart?</h2>
        <p>{text}</p>
      </div>
      <div className="collection-about-points">
        {points.map((pt, i) => (
          <details key={pt.title} open={i === 0}>
            <summary>
              {pt.title}
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <p>{pt.text}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
