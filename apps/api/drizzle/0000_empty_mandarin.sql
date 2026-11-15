CREATE SCHEMA IF NOT EXISTS "cresus";
--> statement-breakpoint
CREATE TABLE "cresus"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cresus"."articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"picto" text,
	"position" integer NOT NULL,
	"on_sale" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cresus"."events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cresus"."sales" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"price_cents" integer NOT NULL,
	"sold_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cresus"."sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cresus"."articles" ADD CONSTRAINT "articles_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "cresus"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cresus"."events" ADD CONSTRAINT "events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "cresus"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cresus"."sales" ADD CONSTRAINT "sales_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "cresus"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cresus"."sales" ADD CONSTRAINT "sales_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "cresus"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cresus"."sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "cresus"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_email_uq" ON "cresus"."accounts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "articles_event_idx" ON "cresus"."articles" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "events_account_date_idx" ON "cresus"."events" USING btree ("account_id","date");--> statement-breakpoint
CREATE INDEX "sales_event_sold_idx" ON "cresus"."sales" USING btree ("event_id","sold_at");--> statement-breakpoint
CREATE INDEX "sales_article_live_idx" ON "cresus"."sales" USING btree ("article_id") WHERE "cresus"."sales"."voided_at" is null;--> statement-breakpoint
CREATE INDEX "sessions_account_idx" ON "cresus"."sessions" USING btree ("account_id");