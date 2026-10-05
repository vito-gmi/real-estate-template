-- Existing credential rows (created before this column existed) get the same
-- synthetic issuer better-auth's sign-in looks up. The default is then dropped
-- so new rows must supply issuer explicitly.
ALTER TABLE "accounts" ADD COLUMN "issuer" text DEFAULT 'local:credential' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "issuer" DROP DEFAULT;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_issuer_account_id_key" ON "accounts" USING btree ("issuer","account_id");