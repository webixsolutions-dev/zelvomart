"use client";

import {useDeliveryPolicy} from "./DeliveryPolicy";
import { useState } from "react";
import { ChevronDown } from "@/components/Icons";

const faqs = [
  ["How do I know this is a real store and not a scam?", "Zelvomart operates with real stock, order confirmation and Cash on Delivery, so you pay when your parcel arrives."],
  ["Can I order without using the website?", "Yes. You can contact the Zelvomart team on WhatsApp and get help placing your order."],
  ["Will the product I receive match the photos?", "Product pages use the actual product information and images stored in our catalogue. If there is an issue, contact support immediately."],
  ["Are beauty and personal care products checked?", "Products are quality checked before dispatch. Always follow the usage instructions shown on the product packaging."],
  ["Are gadgets checked before dispatch?", "Yes. Products are checked before dispatch as part of Zelvomart's quality-control process."],
  ["What is the return or exchange process?", "Use the Returns & Exchange page or contact WhatsApp support. Keep evidence such as an opening video if the parcel arrives damaged or incomplete."],
  ["How long does delivery take?", "Delivery time depends on your city. The checkout and confirmation page show the configured estimate for your location."],
  ["Do I have to pay before delivery?", "No for Cash on Delivery orders. You pay when the parcel reaches you."],
  ["How do I track my order?", "Use your order number and phone on the Track Order page. Once a PostEx tracking number is added, the courier tracking link is shown too."],
  ["How can I get help quickly?", "The WhatsApp button is available on every page and opens a direct conversation with Zelvomart support."],
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  const delivery=useDeliveryPolicy();
  const all=[...faqs,['How much is delivery?',`Delivery costs Rs ${delivery.flatRate.toLocaleString('en-US')}. Delivery is free at Rs ${delivery.threshold.toLocaleString('en-US')} or more, before coupons.`]];
  const columns = [all.slice(0, 5), all.slice(5)];
  return (
    <section className="section faq-wrap">
      <div className="site-shell">
        <div className="section-title" style={{ justifyContent: "center", textAlign: "center" }}>
          <div><h2>Frequently Asked Questions</h2><p>Answers about trust, delivery, ordering and Cash on Delivery.</p></div>
        </div>
        <div className="faq-grid">
          {columns.map((column, col) => (
            <div className="faq-column" key={col}>
              {column.map(([question, answer], localIndex) => {
                const index = col * 5 + localIndex;
                const isOpen = open === index;
                return (
                  <div className="faq-item" key={question}>
                    <button className="faq-button" onClick={() => setOpen(isOpen ? null : index)}>
                      <span className="faq-number">{index + 1}</span>
                      <span className="faq-question">{question}</span>
                      <span className="faq-chevron" style={{ transform: isOpen ? "rotate(180deg)" : undefined }}><ChevronDown size={17} /></span>
                    </button>
                    {isOpen ? <div className="faq-answer">{answer}</div> : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
