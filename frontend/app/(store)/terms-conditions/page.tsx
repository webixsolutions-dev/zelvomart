import { PolicyLayout } from "@store/components/pages/PolicyLayout";
import { policyMetadata } from "@store/lib/policies/metadata";
import { termsPolicy } from "@store/lib/policies/terms";
import { loadPolicy, loadSettings } from "@store/lib/backend";

// Edited in Admin → Pages; saving there refreshes this page (admin proxy revalidates the `pages` tag).
export const revalidate = 600;

export async function generateMetadata() {
  return policyMetadata(await loadPolicy(termsPolicy));
}

export default async function Page() {
  const [policy] = await Promise.all([loadPolicy(termsPolicy), loadSettings()]);
  return <PolicyLayout policy={policy} />;
}
