import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/franchise_analytics",
});

export async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result;
}

export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const output = await work(client);
    await client.query("COMMIT");
    return output;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyConnection() {
  await query("SELECT 1");
}
