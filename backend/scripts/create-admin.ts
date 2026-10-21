import bcrypt from "bcryptjs";
import { createInterface } from "node:readline";
import { Role } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/db";

/**
 * Creates one admin account. The password is typed at the prompt (never read from an environment variable,
 * never printed), and an existing account is never changed: reset passwords and 2FA in Admin → Users.
 *
 *   npm run admin:create --workspace backend -- --email owner@zelvomart.com --name "Owner" [--role OWNER]
 *
 * OWNER and MANAGER accounts set up two-factor sign-in on their first login.
 */
function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

/** Asks questions on one readline interface; typed answers are not echoed when run in a terminal. */
function prompter() {
  const tty = Boolean(process.stdin.isTTY);
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: tty });
  const out = rl as unknown as { _writeToOutput?: (s: string) => void; output: NodeJS.WritableStream };
  let asking = "";
  if (tty) out._writeToOutput = (s: string) => { if (s.includes(asking)) out.output.write(s); };
  const lines: string[] = [];
  const waiting: ((line: string) => void)[] = [];
  rl.on("line", (line) => (waiting.length ? waiting.shift()!(line) : lines.push(line)));
  return {
    ask(question: string) {
      asking = question;
      process.stdout.write(question);
      return new Promise<string>((resolve) => {
        const done = (line: string) => { if (tty) process.stdout.write("\n"); resolve(line); };
        if (lines.length) done(lines.shift()!); else waiting.push(done);
      });
    },
    close: () => rl.close(),
  };
}

async function main() {
  const email = String(arg("email") || "").trim().toLowerCase();
  const name = String(arg("name") || "Owner").trim();
  const role = String(arg("role") || "OWNER").toUpperCase() as Role;
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Pass --email with a valid address.");
  if (!Object.values(Role).includes(role)) throw new Error(`--role must be one of ${Object.values(Role).join(", ")}.`);
  if (await prisma.user.findUnique({ where: { email } })) throw new Error(`${email} already exists. Change it in Admin → Users.`);

  const prompt = prompter();
  const password = await prompt.ask("Password (at least 12 characters): ");
  const again = await prompt.ask("Repeat the password: ");
  prompt.close();
  if (password.length < 12) throw new Error("Use at least 12 characters.");
  if (again !== password) throw new Error("The passwords do not match.");

  const user = await prisma.user.create({
    data: { email, name, role, passwordHash: await bcrypt.hash(password, 12), active: true, twoFactorReady: false, totpSecret: null },
  });
  console.log(`Created ${user.role} ${user.email}.${["OWNER", "MANAGER"].includes(user.role) ? " Two-factor sign-in is set up at the first login." : ""}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
