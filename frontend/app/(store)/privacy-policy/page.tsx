import { PolicyLayout } from "@store/components/pages/PolicyLayout";
import { policyMetadata } from "@store/lib/policies/metadata";
import { privacyPolicy } from "@store/lib/policies/privacy";

export const metadata = policyMetadata(privacyPolicy);

export default function Page() {
  return <PolicyLayout policy={privacyPolicy} />;
}
