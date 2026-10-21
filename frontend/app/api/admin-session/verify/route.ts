import { adminSignInStep } from "@/lib/admin-session";

/** Step 2: the challenge from step 1 plus the 6-digit authenticator code. Sets the session cookie. */
export async function POST(request: Request) {
  return adminSignInStep("/api/auth/login/verify", await request.text());
}
