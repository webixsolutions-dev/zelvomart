import { PolicyLayout } from "@store/components/pages/PolicyLayout";
import { policyMetadata } from "@store/lib/policies/metadata";
import { returnsPolicy } from "@store/lib/policies/returns";

export const metadata = policyMetadata(returnsPolicy);

export default function Page() {
  return <PolicyLayout policy={returnsPolicy} />;
}
