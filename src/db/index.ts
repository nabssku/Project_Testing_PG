import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DbInstance = NeonHttpDatabase<typeof schema>;

let cachedSql: NeonQueryFunction<false, false> | null = null;
let cachedDb: DbInstance | null = null;

function getSqlClient(): NeonQueryFunction<false, false> {
  if (!cachedSql) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) {
      throw new Error(
        "DATABASE_URL belum diatur. Tambahkan DATABASE_URL Neon PostgreSQL di environment variables."
      );
    }
    cachedSql = neon(url);
  }
  return cachedSql;
}

function getDbInstance(): DbInstance {
  if (!cachedDb) {
    cachedDb = drizzle({ client: getSqlClient(), schema });
  }
  return cachedDb;
}

export const db = new Proxy({} as DbInstance, {
  get(_target, prop, receiver) {
    const instance = getDbInstance();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export function sql(strings: TemplateStringsArray, ...params: unknown[]) {
  return getSqlClient()(strings, ...params);
}
