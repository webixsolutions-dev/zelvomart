import type { Metadata } from "next";
import AccountClient from "@/components/AccountClient";

export const metadata: Metadata = {
  title: "My Account",
  description: "Sign in or create your Zelvomart account.",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <div className="zm-account-page">
      <div className="site-shell zm-account-shell">
        <AccountClient />
      </div>
    </div>
  );
}
