import { PolicyLayout } from "@store/components/pages/PolicyLayout";
import { policyMetadata } from "@store/lib/policies/metadata";
import { shippingPolicy } from "@store/lib/policies/shipping";

export const metadata = policyMetadata(shippingPolicy);

export default function Page() {
  return <PolicyLayout policy={shippingPolicy} />;
}
