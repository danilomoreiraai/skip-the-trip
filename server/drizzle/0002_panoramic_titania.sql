CREATE TABLE "cleaning_commands" (
	"command_id" uuid PRIMARY KEY NOT NULL,
	"staff_id" uuid NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"action" varchar(8) NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cleaning_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence" bigserial NOT NULL,
	"building" varchar(3) NOT NULL,
	"floor" varchar(1) NOT NULL,
	"category" "bathroom_category" NOT NULL,
	"started_by" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"expected_end_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_invites" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"staff_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(80) NOT NULL,
	"building" varchar(3) DEFAULT 'HH5' NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "staff_sessions" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"staff_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_invites" ADD CONSTRAINT "staff_invites_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_sessions" ADD CONSTRAINT "staff_sessions_staff_id_staff_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cleaning_commands_created_idx" ON "cleaning_commands" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cleaning_bathroom_sequence_idx" ON "cleaning_cycles" USING btree ("building","floor","category","sequence");--> statement-breakpoint
CREATE INDEX "staff_invites_expires_idx" ON "staff_invites" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "staff_sessions_expires_idx" ON "staff_sessions" USING btree ("expires_at");