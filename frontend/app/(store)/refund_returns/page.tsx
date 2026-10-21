import { PolicyLayout } from "@store/components/pages/PolicyLayout";
import { policyMetadata } from "@store/lib/policies/metadata";
import { returnsPolicy } from "@store/lib/policies/returns";
import { loadPolicy, loadSettings } from "@store/lib/backend";

// Edited in Admin → Pages; saving there refreshes this page (admin proxy revalidates the `pages` tag).
export const revalidate = 600;

export async function generateMetadata() {
  return policyMetadata(await loadPolicy(returnsPolicy));
}

export default async function Page() {
  const [policy] = await Promise.all([loadPolicy(returnsPolicy), loadSettings()]);
  return <PolicyLayout policy={policy} />;
}
