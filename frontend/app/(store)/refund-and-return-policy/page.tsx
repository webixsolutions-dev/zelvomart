import { PolicyLayout } from "@/components/pages/PolicyLayout";
import { policyMetadata } from "@/lib/policies/metadata";
import { returnsPolicy } from "@/lib/policies/returns";

export const metadata = policyMetadata(returnsPolicy);

export default function Page() {
  return <PolicyLayout policy={returnsPolicy} />;
}
