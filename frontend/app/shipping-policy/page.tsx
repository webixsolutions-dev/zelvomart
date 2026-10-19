import { PolicyLayout } from "@/components/launch/pages/PolicyLayout";
import { policyMetadata } from "@/lib/launch/policies/metadata";
import { shippingPolicy } from "@/lib/launch/policies/shipping";

export const metadata = policyMetadata(shippingPolicy);

export default function Page() {
  return <PolicyLayout policy={shippingPolicy} />;
}
