CREATE TABLE "cleaning_events" (
	"cycle_id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "push_deliveries" (
	"cycle_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"discarded_at" timestamp with time zone,
	CONSTRAINT "push_deliveries_cycle_id_subscription_id_pk" PRIMARY KEY("cycle_id","subscription_id")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_hash" varchar(64) NOT NULL,
	"endpoint_hash" varchar(64) NOT NULL,
	"encrypted" text NOT NULL,
	"building" varchar(3) NOT NULL,
	"floor" varchar(1) NOT NULL,
	"category" "bathroom_category" NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "push_subscriptions_owner_hash_unique" UNIQUE("owner_hash"),
	CONSTRAINT "push_subscriptions_endpoint_hash_unique" UNIQUE("endpoint_hash")
);
--> statement-breakpoint
ALTER TABLE "cleaning_events" ADD CONSTRAINT "cleaning_events_cycle_id_cleaning_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cleaning_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_cycle_id_cleaning_events_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cleaning_events"("cycle_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_subscription_id_push_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_deliveries_due_idx" ON "push_deliveries" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "push_subscriptions_bathroom_idx" ON "push_subscriptions" USING btree ("building","floor","category");--> statement-breakpoint
CREATE INDEX "push_subscriptions_expires_idx" ON "push_subscriptions" USING btree ("expires_at");