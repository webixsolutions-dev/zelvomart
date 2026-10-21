import { test } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET ||= "test-secret-test-secret-test-secret-1234";

test("a 2FA challenge is never accepted as a session, and a session never as a challenge", async () => {
  const { signAdminToken, decodeAdminToken, signTwoFactorChallenge, decodeTwoFactorChallenge, ADMIN_TOKEN_SECONDS } = await import("./auth");
  const challenge = signTwoFactorChallenge("user-1", "verify");
  assert.deepEqual(decodeTwoFactorChallenge(challenge), { sub: "user-1", purpose: "verify" });
  assert.throws(() => decodeAdminToken(challenge));
  const session = signAdminToken({ id: "user-1", name: "A", email: "a@example.com", role: "OWNER" as never });
  assert.throws(() => decodeTwoFactorChallenge(session));
  const claims = decodeAdminToken(session) as { exp: number; iat: number };
  assert.equal(claims.exp - claims.iat, ADMIN_TOKEN_SECONDS);
  assert.equal(ADMIN_TOKEN_SECONDS, 2 * 60 * 60);
});

test("TOTP codes verify within one 30-second step and not beyond", async () => {
  const { generateTotpSecret, totpCode, verifyTotp } = await import("./totp");
  const secret = generateTotpSecret();
  assert.equal(verifyTotp(secret, totpCode(secret)), true);
  assert.equal(verifyTotp(secret, totpCode(secret, Date.now() - 30_000)), true);
  assert.equal(verifyTotp(secret, totpCode(secret, Date.now() - 120_000)), false);
  assert.equal(verifyTotp(secret, "12345"), false);
});
