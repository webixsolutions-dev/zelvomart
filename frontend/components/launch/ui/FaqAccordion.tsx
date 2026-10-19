"use client";

import { useState } from "react";
import {useDeliveryPolicy} from "@/components/DeliveryPolicy";
import { Plus } from "lucide-react";


function useDeliveryFaqs(items:{q:string;a:string}[]){const policy=useDeliveryPolicy();return items.map(f=>/how much.*delivery|delivery (cost|charge)|shipping (cost|charge)|free (delivery|shipping)/i.test(f.q)?{...f,a:`Delivery costs Rs. ${policy.flatRate.toLocaleString('en-PK')}, and is free on orders of Rs. ${policy.threshold.toLocaleString('en-PK')} or more. Final delivery charges are shown at checkout.`}:/how long.*(delivery|take)|delivery time/i.test(f.q)?{...f,a:'Estimated delivery is shown for your city at checkout. Unlisted cities take 2–7 working days.'}:f);}

export function FaqAccordion({ items, defaultOpen = 0 }: { items: { q: string; a: string }[]; defaultOpen?: number | null }) {
  items=useDeliveryFaqs(items);
  const [open, setOpen] = useState<number | null>(defaultOpen);
  return (
    <div className="faq-list">
      {items.map((f, i) => (
        <div className={`faq-item ${open === i ? "open" : ""}`} key={f.q}>
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            {f.q}
            <Plus size={18} />
          </button>
          <div className="answer">
            <div>
              <p>{f.a}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FaqJsonLd({ items }: { items: { q: string; a: string }[] }) {
  items=useDeliveryFaqs(items);
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g,"\\u003c") }} />;
}
