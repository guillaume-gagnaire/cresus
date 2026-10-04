CREATE TYPE "public"."billing_mode" AS ENUM('TJM', 'FORFAIT');--> statement-breakpoint
CREATE TYPE "public"."charge_frequency" AS ENUM('MONTHLY', 'YEARLY');--> statement-breakpoint
CREATE TYPE "public"."client_color" AS ENUM('indigo', 'orange', 'violet', 'green', 'rose', 'teal');--> statement-breakpoint
CREATE TYPE "public"."leave_scope" AS ENUM('ALL', 'CLIENT');--> statement-breakpoint
CREATE TYPE "public"."legal_status" AS ENUM('SASU', 'SAS', 'SASU_IR', 'SARL', 'EURL_IS', 'EURL_IR', 'EI', 'MICRO');--> statement-breakpoint
CREATE TYPE "public"."payment_term" AS ENUM('RECEPTION', 'NET_30', 'NET_45', 'EOM_30', 'NET_60');--> statement-breakpoint
CREATE TABLE "balance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" integer NOT NULL,
	"frequency" charge_frequency NOT NULL,
	"month" integer,
	"category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"subtitle" text,
	"color" "client_color" NOT NULL,
	"billing_mode" "billing_mode" NOT NULL,
	"weekdays" smallint[] DEFAULT '{}'::smallint[] NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"payment_term" "payment_term" NOT NULL,
	"average_delay_days" integer DEFAULT 0 NOT NULL,
	"is_prospect" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"scope" "leave_scope" NOT NULL,
	"client_id" uuid,
	CONSTRAINT "leaves_user_date_client_uq" UNIQUE NULLS NOT DISTINCT("user_id","date","client_id")
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" "bytea" NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" text[] DEFAULT '{}'::text[] NOT NULL,
	"device_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passkeys_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"valid_from" date NOT NULL,
	"amount" integer NOT NULL,
	CONSTRAINT "rates_client_valid_from_uq" UNIQUE("client_id","valid_from")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"first_name" text NOT NULL,
	"company_name" text,
	"legal_status" "legal_status" DEFAULT 'SASU' NOT NULL,
	"net_pay_monthly" integer DEFAULT 0 NOT NULL,
	"micro_versement_liberatoire" boolean DEFAULT false NOT NULL,
	"micro_income_tax_provision_pct" integer DEFAULT 10 NOT NULL,
	"micro_pro_expenses_monthly" integer DEFAULT 18000 NOT NULL,
	"include_prospects" boolean DEFAULT false NOT NULL,
	"alert_red_month" boolean DEFAULT true NOT NULL,
	"alert_late_payment" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rates" ADD CONSTRAINT "rates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "balance_user_date_idx" ON "balance_snapshots" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "charges_user_idx" ON "charges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clients_user_idx" ON "clients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");