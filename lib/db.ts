import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  if (process.env.NODE_ENV === "development") {
    if (!global._pgPool) {
      global._pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
    }
    return global._pgPool;
  }
  return new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
}

let initialised = false;
export async function getDb(): Promise<Pool> {
  const pool = getPool();
  if (!initialised) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_config (
        app_id            TEXT PRIMARY KEY,
        sheet_url         TEXT,
        gas_url           TEXT,
        column_map        JSONB,
        google_client_id  TEXT,
        google_client_sec TEXT,
        session_secret    TEXT,
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS admin_emails (
        app_id  TEXT NOT NULL,
        email   TEXT NOT NULL,
        name    TEXT,
        PRIMARY KEY (app_id, email)
      );
    `);
    await pool.query(`
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS google_client_id  TEXT;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS google_client_sec TEXT;
      ALTER TABLE app_config ADD COLUMN IF NOT EXISTS session_secret    TEXT;
    `).catch(() => {});
    initialised = true;
  }
  return pool;
}

export interface AppConfig {
  app_id:            string;
  sheet_url:         string | null;
  gas_url:           string | null;
  column_map:        object | null;
  google_client_id:  string | null;
  google_client_sec: string | null;
  session_secret:    string | null;
  updated_at:        Date;
}

export async function getConfig(appId: string): Promise<AppConfig | null> {
  const db  = await getDb();
  const res = await db.query("SELECT * FROM app_config WHERE app_id = $1", [appId]);
  return (res.rows[0] as AppConfig) ?? null;
}

export async function upsertConfig(appId: string, fields: {
  sheetUrl?:        string;
  gasUrl?:          string;
  columnMap?:       object;
  googleClientId?:  string;
  googleClientSec?: string;
  sessionSecret?:   string;
}) {
  const db = await getDb();
  await db.query(`
    INSERT INTO app_config (app_id, sheet_url, gas_url, column_map, google_client_id, google_client_sec, session_secret, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (app_id) DO UPDATE SET
      sheet_url         = COALESCE($2, app_config.sheet_url),
      gas_url           = COALESCE($3, app_config.gas_url),
      column_map        = COALESCE($4, app_config.column_map),
      google_client_id  = COALESCE($5, app_config.google_client_id),
      google_client_sec = COALESCE($6, app_config.google_client_sec),
      session_secret    = COALESCE($7, app_config.session_secret),
      updated_at        = NOW()
  `, [
    appId,
    fields.sheetUrl        ?? null,
    fields.gasUrl          ?? null,
    fields.columnMap       ? JSON.stringify(fields.columnMap) : null,
    fields.googleClientId  ?? null,
    fields.googleClientSec ?? null,
    fields.sessionSecret   ?? null,
  ]);
}

export async function resolveConfig(appId: string): Promise<{
  sheetUrl:       string;
  gasUrl:         string;
  googleClientId: string;
  sessionSecret:  string;
}> {
  let row: AppConfig | null = null;
  try { row = await getConfig(appId); } catch { /* fall through */ }
  return {
    sheetUrl:       row?.sheet_url         || process.env.NEXT_PUBLIC_SHEET_URL || "",
    gasUrl:         row?.gas_url           || process.env.GAS_URL               || "",
    googleClientId: row?.google_client_id  || process.env.GOOGLE_CLIENT_ID      || "",
    sessionSecret:  row?.session_secret    || process.env.SESSION_SECRET        || "fallback-secret-change-me",
  };
}

export async function getAdminEmails(appId: string): Promise<string[]> {
  const db  = await getDb();
  const res = await db.query("SELECT email FROM admin_emails WHERE app_id = $1", [appId]);
  return res.rows.map((r: { email: string }) => r.email.toLowerCase().trim());
}

export async function upsertAdminEmail(appId: string, email: string, name?: string) {
  const db = await getDb();
  await db.query(`
    INSERT INTO admin_emails (app_id, email, name)
    VALUES ($1, $2, $3)
    ON CONFLICT (app_id, email) DO UPDATE SET name = COALESCE($3, admin_emails.name)
  `, [appId, email.toLowerCase().trim(), name ?? null]);
}

export async function deleteAdminEmail(appId: string, email: string) {
  const db = await getDb();
  await db.query("DELETE FROM admin_emails WHERE app_id = $1 AND email = $2",
    [appId, email.toLowerCase().trim()]);
}
