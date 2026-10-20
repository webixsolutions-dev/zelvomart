import { PolicyLayout } from "@/components/pages/PolicyLayout";
import { policyMetadata } from "@/lib/policies/metadata";
import { termsPolicy } from "@/lib/policies/terms";

export const metadata = policyMetadata(termsPolicy);

export default function Page() {
  return <PolicyLayout policy={termsPolicy} />;
}
