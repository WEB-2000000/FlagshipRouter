CREATE TABLE "_meta" (
	"key" text PRIMARY KEY,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apiKeys" (
	"id" text PRIMARY KEY,
	"key" text NOT NULL UNIQUE,
	"name" text,
	"machineId" text,
	"isActive" integer DEFAULT 1,
	"createdAt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_secrets" (
	"key" text PRIMARY KEY,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "combos" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"kind" text,
	"models" text NOT NULL,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kv" (
	"scope" text,
	"key" text,
	"value" text NOT NULL,
	CONSTRAINT "kv_pkey" PRIMARY KEY("scope","key")
);
--> statement-breakpoint
CREATE TABLE "providerConnections" (
	"id" text PRIMARY KEY,
	"provider" text NOT NULL,
	"authType" text NOT NULL,
	"name" text,
	"email" text,
	"priority" integer,
	"isActive" integer DEFAULT 1,
	"data" text NOT NULL,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providerNodes" (
	"id" text PRIMARY KEY,
	"type" text,
	"name" text,
	"data" text NOT NULL,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proxyPools" (
	"id" text PRIMARY KEY,
	"isActive" integer DEFAULT 1,
	"testStatus" text,
	"data" text NOT NULL,
	"createdAt" text NOT NULL,
	"updatedAt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requestDetails" (
	"id" text PRIMARY KEY,
	"timestamp" text NOT NULL,
	"provider" text,
	"model" text,
	"connectionId" text,
	"status" text,
	"data" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY,
	"data" text NOT NULL,
	CONSTRAINT "settings_singleton" CHECK ("id" = 1)
);
--> statement-breakpoint
CREATE TABLE "usageDaily" (
	"dateKey" text PRIMARY KEY,
	"data" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usageHistory" (
	"id" serial PRIMARY KEY,
	"timestamp" text NOT NULL,
	"provider" text,
	"model" text,
	"connectionId" text,
	"apiKey" text,
	"endpoint" text,
	"promptTokens" integer DEFAULT 0,
	"completionTokens" integer DEFAULT 0,
	"cost" double precision DEFAULT 0,
	"status" text,
	"tokens" text,
	"meta" text
);
--> statement-breakpoint
CREATE INDEX "idx_ak_key" ON "apiKeys" ("key");--> statement-breakpoint
CREATE INDEX "idx_combo_name" ON "combos" ("name");--> statement-breakpoint
CREATE INDEX "idx_kv_scope" ON "kv" ("scope");--> statement-breakpoint
CREATE INDEX "idx_pc_provider" ON "providerConnections" ("provider");--> statement-breakpoint
CREATE INDEX "idx_pc_provider_active" ON "providerConnections" ("provider","isActive");--> statement-breakpoint
CREATE INDEX "idx_pc_priority" ON "providerConnections" ("provider","priority");--> statement-breakpoint
CREATE INDEX "idx_pn_type" ON "providerNodes" ("type");--> statement-breakpoint
CREATE INDEX "idx_pp_active" ON "proxyPools" ("isActive");--> statement-breakpoint
CREATE INDEX "idx_pp_status" ON "proxyPools" ("testStatus");--> statement-breakpoint
CREATE INDEX "idx_rd_ts" ON "requestDetails" ("timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_rd_provider" ON "requestDetails" ("provider");--> statement-breakpoint
CREATE INDEX "idx_rd_model" ON "requestDetails" ("model");--> statement-breakpoint
CREATE INDEX "idx_rd_conn" ON "requestDetails" ("connectionId");--> statement-breakpoint
CREATE INDEX "idx_uh_ts" ON "usageHistory" ("timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_uh_provider" ON "usageHistory" ("provider");--> statement-breakpoint
CREATE INDEX "idx_uh_model" ON "usageHistory" ("model");--> statement-breakpoint
CREATE INDEX "idx_uh_conn" ON "usageHistory" ("connectionId");