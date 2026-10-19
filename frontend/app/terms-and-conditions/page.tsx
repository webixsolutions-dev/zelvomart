import { PolicyLayout } from "@/components/launch/pages/PolicyLayout";
import { policyMetadata } from "@/lib/launch/policies/metadata";
import { termsPolicy } from "@/lib/launch/policies/terms";

export const metadata = policyMetadata(termsPolicy);

export default function Page() {
  return <PolicyLayout policy={termsPolicy} />;
}
