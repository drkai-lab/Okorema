import * as SQLite from "expo-sqlite";

import { SCHEMA, SqliteRepository, type Repository } from "@/db/repository";

export async function openRepository(): Promise<Repository> {
  const db = await SQLite.openDatabaseAsync("okorema.db");
  await db.execAsync(SCHEMA);
  return new SqliteRepository(db);
}
