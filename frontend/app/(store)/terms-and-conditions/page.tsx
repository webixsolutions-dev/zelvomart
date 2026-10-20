import { PolicyLayout } from "@store/components/pages/PolicyLayout";
import { policyMetadata } from "@store/lib/policies/metadata";
import { termsPolicy } from "@store/lib/policies/terms";

export const metadata = policyMetadata(termsPolicy);

export default function Page() {
  return <PolicyLayout policy={termsPolicy} />;
}
