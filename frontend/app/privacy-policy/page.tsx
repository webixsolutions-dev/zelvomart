import { PolicyLayout } from "@/components/launch/pages/PolicyLayout";
import { policyMetadata } from "@/lib/launch/policies/metadata";
import { privacyPolicy } from "@/lib/launch/policies/privacy";
import PrivacyControl from '@/components/launch/pages/PrivacyControl';

export const metadata = policyMetadata(privacyPolicy);

export default function Page() {
  return <><PolicyLayout policy={privacyPolicy} /><PrivacyControl/></>;
}
