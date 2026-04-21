import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mode = process.argv[2];
const validModes = new Set(["schema", "seed"]);

if (!validModes.has(mode)) {
  console.error("Usage: node scripts/run-sql.js <schema|seed>");
  process.exit(1);
}

const sqlFile = mode === "schema" ? "schema.sql" : "seed.sql";
const sqlPath = path.join(__dirname, "..", "sql", sqlFile);

if (!fs.existsSync(sqlPath)) {
  console.error(`SQL file not found: ${sqlPath}`);
  process.exit(1);
}

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/franchise_analytics";

const pool = new Pool({ connectionString });

async function run() {
  try {
    const sql = fs.readFileSync(sqlPath, "utf8");
    await pool.query(sql);
    console.log(`Executed ${sqlFile} successfully.`);
  } catch (error) {
    console.error(`Failed to execute ${sqlFile}:`, error.message || error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

await run();
