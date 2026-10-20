import type { Metadata } from "next";
import { shareMeta } from "@store/lib/seo";
import { TrackOrderView } from "@store/components/pages/TrackOrderView";

export const metadata: Metadata = {
  title: { absolute: "Track Your Zelvomart Order" },
  description:
    "Track your Zelvomart order with your order number and mobile number, and see each step from confirmation to delivery, anywhere in Pakistan.",
  alternates: { canonical: "/track-your-order/" },
  ...shareMeta({ title: "Track Your Zelvomart Order", description: "Track your Zelvomart order with your order number and mobile number, and see each step from confirmation to delivery, anywhere in Pakistan.", path: "/track-your-order/" }),
};

export default function Page() {
  return <TrackOrderView />;
}
