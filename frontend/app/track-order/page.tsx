import TrackOrderClient from "@/components/TrackOrderClient";
export const metadata = { title: "Track Order" };
export default function TrackOrderPage() { return <div className="site-shell"><div className="page-head"><h1>Track your order</h1><p>Enter the order number and the phone number used at checkout.</p></div><TrackOrderClient /></div>; }
