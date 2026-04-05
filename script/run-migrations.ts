import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[migrate] DATABASE_URL is not set, skipping migrations");
  process.exit(0);
}

const migrationsDir = path.resolve(import.meta.dirname, "../migrations");
const files = fs
  .readdirSync(migrationsDir)
  .filter((f: string) => f.endsWith(".sql") && !f.includes(".down."))
  .sort();

if (files.length === 0) {
  console.log("[migrate] no migration files found");
  process.exit(0);
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

// Create a tracking table so migrations only run once
await client.query(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name text PRIMARY KEY,
    applied_at timestamp DEFAULT now()
  )
`);

for (const file of files) {
  const [{ count }] = (
    await client.query("SELECT count(*)::int AS count FROM _migrations WHERE name = $1", [file])
  ).rows;

  if (count > 0) {
    console.log(`[migrate] ${file} — already applied, skipping`);
    continue;
  }

  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
  console.log(`[migrate] applying ${file}...`);
  try {
    await client.query(sql);
    await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
    console.log(`[migrate] ${file} — done`);
  } catch (err: any) {
    console.error(`[migrate] ${file} — failed: ${err.message}`);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log("[migrate] all migrations applied");
