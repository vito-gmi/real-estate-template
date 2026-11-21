import "../src/server/db/script-env.ts";

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { eq } from "drizzle-orm";
import { userRoles, type UserRole } from "../src/lib/domain/enums.ts";
import { auth } from "../src/server/auth/config.ts";
import { db } from "../src/server/db/client.ts";
import { users } from "../src/server/db/schema/index.ts";

/**
 * Provisions a staff account.
 *
 * Self-service sign-up is disabled (`disableSignUp`), and better-auth applies
 * that flag to `auth.api.signUpEmail` as well. This script therefore hashes the
 * password with the same Argon2id settings the app uses and writes through
 * better-auth's internal adapter — the public registration endpoint stays closed.
 *
 * The new account cannot reach any admin page until it enrols an authenticator;
 * `requireStaff` sends it to the setup flow on first sign-in.
 */
async function askPassword(
  rl: ReturnType<typeof createInterface>,
): Promise<string> {
  const password = (
    await rl.question("Password (min 12 characters): ")
  ).trim();
  if (password.length < 12)
    throw new Error("Password must be at least 12 characters.");
  return password;
}

async function setCredentialPassword(
  ctx: Awaited<typeof auth.$context>,
  userId: string,
  password: string,
) {
  const hash = await ctx.password.hash(password);
  if (await ctx.internalAdapter.findCredentialAccount(userId)) {
    await ctx.internalAdapter.updatePassword(userId, hash);
    return;
  }

  // Since better-auth 1.7.3 accounts are keyed on (providerId, accountId);
  // the 1.7.0–1.7.2 `issuer` field is gone. For email/password the
  // accountId is the user's own id, as better-auth's sign-up writes it.
  await ctx.internalAdapter.linkAccount({
    userId,
    providerId: "credential",
    accountId: userId,
    password: hash,
  });
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const email = (await rl.question("Email: ")).trim().toLowerCase();
    if (!email.includes("@"))
      throw new Error("That does not look like an email address.");

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));

    const ctx = await auth.$context;

    if (existing[0]) {
      const reset = (
        await rl.question(
          `An account already exists for ${email}. Reset its password? [y/N]: `,
        )
      )
        .trim()
        .toLowerCase();
      if (reset !== "y" && reset !== "yes")
        throw new Error(`An account already exists for ${email}.`);

      await setCredentialPassword(ctx, existing[0].id, await askPassword(rl));
      console.log(`\n✓ reset password for ${email}`);
      return;
    }

    const name =
      (await rl.question("Full name: ")).trim() || email.split("@")[0]!;

    const roleAnswer = (
      await rl.question(`Role (${userRoles.join(" / ")}) [admin]: `)
    ).trim();
    const role = (roleAnswer || "admin") as UserRole;
    if (!userRoles.includes(role)) throw new Error(`Unknown role: ${role}`);

    const password = await askPassword(rl);

    const created = await ctx.internalAdapter.createUser(
      {
        email,
        name,
        emailVerified: true,
        role,
      },
      { method: "admin" },
    );
    if (!created) throw new Error("Failed to create the user row.");

    await setCredentialPassword(ctx, created.id, password);

    // `role` is `input: false` on the auth schema, so the adapter may ignore it
    // on create. The update is the guarantee the console will honour.
    await db.update(users).set({ role }).where(eq(users.id, created.id));

    console.log(`\n✓ created ${role} account for ${email}`);
    console.log(
      "  Sign in at /bg/admin/login — you will be asked to set up two-factor auth.",
    );
  } finally {
    rl.close();
  }

  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(`\n✗ ${(error as Error).message}`);
  process.exit(1);
});
