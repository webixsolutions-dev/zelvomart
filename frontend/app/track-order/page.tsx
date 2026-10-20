import type { Metadata } from "next";
import { TrackOrderView } from "@/components/launch/pages/TrackOrderView";
import { shareMeta } from "@/lib/launch/seo";

export const metadata: Metadata = {
  title: { absolute: "Track Your Zelvomart Order" },
  description:
    "Track your Zelvomart order with your order number and mobile number, and see each step from confirmation to delivery, anywhere in Pakistan.",
  alternates: { canonical: "/track-order/" },
  ...shareMeta({
    title: "Track Your Zelvomart Order",
    description:
      "Track your Zelvomart order with your order number and mobile number, and see each step from confirmation to delivery, anywhere in Pakistan.",
    path: "/track-order/",
  }),
};

export default function TrackOrderPage() {
  return <TrackOrderView />;
}
