CREATE TABLE "active_votes" (
	"anonymous_id" uuid NOT NULL,
	"building" varchar(3) NOT NULL,
	"floor" varchar(1) NOT NULL,
	"category" "bathroom_category" NOT NULL,
	"available" boolean NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "active_votes_anonymous_id_building_floor_category_pk" PRIMARY KEY("anonymous_id","building","floor","category")
);
--> statement-breakpoint
CREATE TABLE "location_authorizations" (
	"anonymous_id" uuid NOT NULL,
	"location_id" varchar(16) NOT NULL,
	"verified_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "location_authorizations_anonymous_id_location_id_pk" PRIMARY KEY("anonymous_id","location_id")
);
--> statement-breakpoint
CREATE INDEX "active_votes_bathroom_expires_at_idx" ON "active_votes" USING btree ("building","floor","category","expires_at");--> statement-breakpoint
CREATE INDEX "location_authorizations_expires_at_idx" ON "location_authorizations" USING btree ("expires_at");