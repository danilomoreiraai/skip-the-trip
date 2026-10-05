CREATE TYPE "public"."bathroom_category" AS ENUM('Male', 'Accessible', 'Female');--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building" varchar(3) NOT NULL,
	"floor" varchar(1) NOT NULL,
	"category" "bathroom_category" NOT NULL,
	"available" boolean NOT NULL,
	"client_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "reports_idempotency_key_unique" ON "reports" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "reports_bathroom_created_at_idx" ON "reports" USING btree ("building","floor","category","created_at");--> statement-breakpoint
CREATE INDEX "reports_client_created_at_idx" ON "reports" USING btree ("client_id","created_at");