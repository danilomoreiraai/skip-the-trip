CREATE TABLE "bathroom_status" (
	"building" varchar(3) NOT NULL,
	"floor" varchar(1) NOT NULL,
	"category" "bathroom_category" NOT NULL,
	"available" boolean NOT NULL,
	"last_reported_at" timestamp with time zone NOT NULL,
	"closed_until" timestamp with time zone,
	CONSTRAINT "bathroom_status_building_floor_category_pk" PRIMARY KEY("building","floor","category")
);
