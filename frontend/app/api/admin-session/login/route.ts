import { adminSignInStep } from "@/lib/admin-session";

/** Step 1: email and password. Answers with the session, or with a 2FA challenge for the code step. */
export async function POST(request: Request) {
  return adminSignInStep("/api/auth/login", await request.text());
}
