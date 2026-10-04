CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'USER');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'USER' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_single_admin_uq" ON "users" USING btree ("role") WHERE "users"."role" = 'ADMIN';