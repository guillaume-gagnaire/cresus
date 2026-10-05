ALTER TABLE "oauth_tokens" ADD COLUMN "code_hash" text;--> statement-breakpoint
CREATE INDEX "oauth_tokens_code_idx" ON "oauth_tokens" USING btree ("code_hash");