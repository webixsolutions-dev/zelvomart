import { PolicyLayout } from "@/components/pages/PolicyLayout";
import { policyMetadata } from "@/lib/policies/metadata";
import { shippingPolicy } from "@/lib/policies/shipping";

export const metadata = policyMetadata(shippingPolicy);

export default function Page() {
  return <PolicyLayout policy={shippingPolicy} />;
}
