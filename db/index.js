import { drizzle } from "drizzle-orm/netlify-db";

// Lazy: static-page generation must not open or initialize a production DB.
let database;
export function getAppDatabase() {
  return database ??= drizzle();
}
