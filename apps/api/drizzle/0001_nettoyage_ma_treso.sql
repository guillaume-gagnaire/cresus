-- Nettoyage unique des restes de Ma Tréso, l'application qui occupait auparavant la base de production :
-- ses tables et ses types dans « public », son journal de migrations dans « drizzle ». Sans effet sur une base neuve
-- (IF EXISTS). Toutes les tables de Cresus sont dans le schéma « cresus » et ne sont pas touchées.
DROP TABLE IF EXISTS "public"."oauth_tokens", "public"."oauth_codes", "public"."oauth_requests", "public"."oauth_clients", "public"."passkeys", "public"."balance_snapshots", "public"."rates", "public"."leaves", "public"."charges", "public"."clients", "public"."sessions", "public"."users" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."billing_mode", "public"."charge_frequency", "public"."client_color", "public"."leave_scope", "public"."legal_status", "public"."payment_term", "public"."user_role" CASCADE;--> statement-breakpoint
DROP SCHEMA IF EXISTS "drizzle" CASCADE;
