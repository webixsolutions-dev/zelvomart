import { PolicyLayout } from "@/components/pages/PolicyLayout";
import { policyMetadata } from "@/lib/policies/metadata";
import { privacyPolicy } from "@/lib/policies/privacy";

export const metadata = policyMetadata(privacyPolicy);

export default function Page() {
  return <PolicyLayout policy={privacyPolicy} />;
}
