import { ArrowRight, Clock3 } from "lucide-react";
import { site } from "@/lib/launch/site";
import { waLink } from "@/lib/launch/format";
import { WhatsAppIcon } from "@/components/launch/ui/BrandIcons";

export function WhatsAppCta() {
  return (
    <section className="wa-cta" aria-labelledby="wa-cta-title">
      <span className="wa-cta-glow" aria-hidden="true" />
      <div className="container wa-cta-inner">
        <div className="wa-cta-copy">
          <span className="wa-cta-badge">
            <span className="wa-cta-dot" aria-hidden="true" />
            We&apos;re online · {site.supportHours}
          </span>
          <h2 id="wa-cta-title">Got a question? Let&apos;s talk it through.</h2>
          <p>
            Ask for real photos, sizes, colours or delivery time to your city before you order. Our team replies personally on
            WhatsApp — no bots, no scripts, just honest answers.
          </p>
        </div>
        <div className="wa-cta-action">
          <a className="wa-cta-btn" href={waLink(site.whatsappNumber, "Hi Zelvomart! I have a question.")} target="_blank" rel="noopener noreferrer">
            <span className="wa-cta-btn-ico">
              <WhatsAppIcon size={20} />
            </span>
            Chat on WhatsApp
            <ArrowRight size={17} className="wa-cta-arrow" />
          </a>
          <small>
            <Clock3 size={13} /> Usually replies within minutes
          </small>
        </div>
      </div>
    </section>
  );
}
