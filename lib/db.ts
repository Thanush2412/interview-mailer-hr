import { getFirestore } from "./firebase";
import type { Firestore } from "firebase-admin/firestore";

export async function getDb(): Promise<Firestore> {
  return getFirestore();
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
  const db = await getDb();
  const doc = await db.collection("app_config").doc(appId).get();
  if (!doc.exists) return null;
  return doc.data() as AppConfig;
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
  const docRef = db.collection("app_config").doc(appId);
  const doc = await docRef.get();
  
  const updateData: Record<string, unknown> = {
    updated_at: new Date(),
  };
  
  if (fields.sheetUrl !== undefined) updateData.sheet_url = fields.sheetUrl;
  if (fields.gasUrl !== undefined) updateData.gas_url = fields.gasUrl;
  if (fields.columnMap !== undefined) updateData.column_map = fields.columnMap;
  if (fields.googleClientId !== undefined) updateData.google_client_id = fields.googleClientId;
  if (fields.googleClientSec !== undefined) updateData.google_client_sec = fields.googleClientSec;
  if (fields.sessionSecret !== undefined) updateData.session_secret = fields.sessionSecret;
  
  if (doc.exists) {
    await docRef.update(updateData);
  } else {
    await docRef.set({
      app_id: appId,
      sheet_url: fields.sheetUrl ?? null,
      gas_url: fields.gasUrl ?? null,
      column_map: fields.columnMap ?? null,
      google_client_id: fields.googleClientId ?? null,
      google_client_sec: fields.googleClientSec ?? null,
      session_secret: fields.sessionSecret ?? null,
      updated_at: new Date(),
    });
  }
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
    sessionSecret:  row?.session_secret    || process.env.SESSION_SECRET        || "",
  };
}

export async function getAdminEmails(appId: string): Promise<string[]> {
  const db = await getDb();
  const snapshot = await db.collection("admin_emails")
    .where("app_id", "==", appId)
    .get();
  return snapshot.docs.map(doc => doc.data().email.toLowerCase().trim());
}

// Alias used by admins API route
export async function getAdmins(appId: string): Promise<{ email: string; name: string | null }[]> {
  const db = await getDb();
  const snapshot = await db.collection("admin_emails")
    .where("app_id", "==", appId)
    .get();
  
  // Sort in memory instead of using orderBy to avoid index requirement
  const admins = snapshot.docs.map(doc => ({
    email: doc.data().email,
    name: doc.data().name ?? null,
  }));
  
  return admins.sort((a, b) => a.email.localeCompare(b.email));
}

export async function upsertAdminEmail(appId: string, email: string, name?: string) {
  const db = await getDb();
  const normalizedEmail = email.toLowerCase().trim();
  const docId = `${appId}_${normalizedEmail}`;
  const docRef = db.collection("admin_emails").doc(docId);
  const doc = await docRef.get();
  
  if (doc.exists) {
    await docRef.update({
      name: name ?? doc.data()?.name ?? null,
    });
  } else {
    await docRef.set({
      app_id: appId,
      email: normalizedEmail,
      name: name ?? null,
    });
  }
}

export async function deleteAdminEmail(appId: string, email: string) {
  const db = await getDb();
  const normalizedEmail = email.toLowerCase().trim();
  const docId = `${appId}_${normalizedEmail}`;
  await db.collection("admin_emails").doc(docId).delete();
}
