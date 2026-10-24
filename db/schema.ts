// Physical names preserve the existing repository SQL contract.
import { pgTable, text, integer, serial, doublePrecision, primaryKey, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const _meta = pgTable("_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
}, (table) => [
]);

export const settings = pgTable("settings", {
  id: integer("id").primaryKey(),
  data: text("data").notNull(),
}, (table) => [
  check("settings_singleton", sql`${table.id} = 1`),
]);

export const providerConnections = pgTable("providerConnections", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  authType: text("authType").notNull(),
  name: text("name"),
  email: text("email"),
  priority: integer("priority"),
  isActive: integer("isActive").default(1),
  data: text("data").notNull(),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
}, (table) => [
  index("idx_pc_provider").on(table.provider),
  index("idx_pc_provider_active").on(table.provider, table.isActive),
  index("idx_pc_priority").on(table.provider, table.priority),
]);

export const providerNodes = pgTable("providerNodes", {
  id: text("id").primaryKey(),
  type: text("type"),
  name: text("name"),
  data: text("data").notNull(),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
}, (table) => [
  index("idx_pn_type").on(table.type),
]);

export const proxyPools = pgTable("proxyPools", {
  id: text("id").primaryKey(),
  isActive: integer("isActive").default(1),
  testStatus: text("testStatus"),
  data: text("data").notNull(),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
}, (table) => [
  index("idx_pp_active").on(table.isActive),
  index("idx_pp_status").on(table.testStatus),
]);

export const apiKeys = pgTable("apiKeys", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name"),
  machineId: text("machineId"),
  isActive: integer("isActive").default(1),
  createdAt: text("createdAt").notNull(),
}, (table) => [
  index("idx_ak_key").on(table.key),
]);

export const combos = pgTable("combos", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  kind: text("kind"),
  models: text("models").notNull(),
  createdAt: text("createdAt").notNull(),
  updatedAt: text("updatedAt").notNull(),
}, (table) => [
  index("idx_combo_name").on(table.name),
]);

export const kv = pgTable("kv", {
  scope: text("scope").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
}, (table) => [
  primaryKey({ columns: [table.scope, table.key] }),
  index("idx_kv_scope").on(table.scope),
]);

export const usageHistory = pgTable("usageHistory", {
  id: serial("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  provider: text("provider"),
  model: text("model"),
  connectionId: text("connectionId"),
  apiKey: text("apiKey"),
  endpoint: text("endpoint"),
  promptTokens: integer("promptTokens").default(0),
  completionTokens: integer("completionTokens").default(0),
  cost: doublePrecision("cost").default(0),
  status: text("status"),
  tokens: text("tokens"),
  meta: text("meta"),
}, (table) => [
  index("idx_uh_ts").on(table.timestamp.desc()),
  index("idx_uh_provider").on(table.provider),
  index("idx_uh_model").on(table.model),
  index("idx_uh_conn").on(table.connectionId),
]);

export const usageDaily = pgTable("usageDaily", {
  dateKey: text("dateKey").primaryKey(),
  data: text("data").notNull(),
}, (table) => [
]);

export const requestDetails = pgTable("requestDetails", {
  id: text("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  provider: text("provider"),
  model: text("model"),
  connectionId: text("connectionId"),
  status: text("status"),
  data: text("data").notNull(),
}, (table) => [
  index("idx_rd_ts").on(table.timestamp.desc()),
  index("idx_rd_provider").on(table.provider),
  index("idx_rd_model").on(table.model),
  index("idx_rd_conn").on(table.connectionId),
]);

export const appSecrets = pgTable("app_secrets", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
