import { PolicyLayout } from "@/components/launch/pages/PolicyLayout";
import { policyMetadata } from "@/lib/launch/policies/metadata";
import { returnsPolicy } from "@/lib/launch/policies/returns";

export const metadata = policyMetadata(returnsPolicy);

export default function Page() {
  return <PolicyLayout policy={returnsPolicy} />;
}
