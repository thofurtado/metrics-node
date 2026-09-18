import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { env } from '@/env';

// Pool for querying the Master Database
const pool = new Pool({
  connectionString: process.env.MASTER_DATABASE_URL || "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432/db_master?schema=public",
});

// Cache for PrismaClient instances to avoid memory leaks
const prismaClients = new Map<string, PrismaClient>();

export async function getDbNameForDomain(domain: string): Promise<string | null> {
  const cleanDomain = domain.split(',')[0].trim();
  const result = await pool.query('SELECT "dbName" FROM "Tenant" WHERE $1 = ANY(string_to_array(replace(domain, \' \', \'\'), \',\')) AND status = $2', [cleanDomain, 'active']);
  if (result.rows.length === 0) {
    return null;
  }
  return result.rows[0].dbName;
}

export async function getPrismaForDomain(domain: string): Promise<PrismaClient | null> {
  const cleanDomain = domain.split(',')[0].trim();
  // If we already have a PrismaClient for this domain in cache, return it
  if (prismaClients.has(cleanDomain)) {
    return prismaClients.get(cleanDomain)!;
  }

  // Find which database belongs to this domain
  const dbName = await getDbNameForDomain(cleanDomain);
  if (!dbName) {
    return null; // Domain not recognized or suspended
  }

  // Construct the connection string dynamically
  // Assuming all tenant databases are on the same Postgres server as defined by a base URL
  const baseUrl = process.env.DATABASE_BASE_URL || "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432";
  const tenantUrl = `${baseUrl}/${dbName}?schema=public`;

  // Instantiate a new PrismaClient for this specific tenant
  const tenantPrisma = new PrismaClient({
    datasources: {
      db: {
        url: tenantUrl,
      },
    },
    log: env.NODE_ENV === 'dev' ? ['query'] : [],
  });

  // Save to cache
  prismaClients.set(cleanDomain, tenantPrisma);

  return tenantPrisma;
}
export async function getMasterPool() {
  return pool
}

export async function getActiveTenantDbNames(): Promise<string[]> {
  const result = await pool.query('SELECT "dbName" FROM "Tenant" WHERE "status" = $1 ORDER BY "dbName"', ['active'])
  return result.rows.map((row) => String(row.dbName)).filter(Boolean)
}

export async function getIfoodCredentials(): Promise<{ clientId: string; clientSecret: string } | null> {
  const result = await pool.query(
    'SELECT "clientId", "clientSecret" FROM "SaaSIntegrationConfig" WHERE "provider" = $1 LIMIT 1',
    ['IFOOD'],
  )
  const row = result.rows[0]
  return row?.clientId && row?.clientSecret
    ? { clientId: row.clientId, clientSecret: row.clientSecret }
    : null
}

export async function saveIfoodCredentials(clientId: string, clientSecret: string) {
  await pool.query(
    `INSERT INTO "SaaSIntegrationConfig" ("id", "provider", "clientId", "clientSecret", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, $3, NOW())
     ON CONFLICT ("provider") DO UPDATE SET "clientId" = EXCLUDED."clientId", "clientSecret" = EXCLUDED."clientSecret", "updatedAt" = NOW()`
    , ['IFOOD', clientId, clientSecret],
  )
}

export async function getPrismaForDb(dbName: string): Promise<PrismaClient> {
  const cacheKey = `db:${dbName}`;
  if (prismaClients.has(cacheKey)) {
    return prismaClients.get(cacheKey)!;
  }

  const baseUrl = process.env.DATABASE_BASE_URL || "postgres://postgres:hvuDvmTtt4qbXxF2AQmwQvTMVblJ346M0W4elmnxndJtnMALQcD96gbuspvI771C@187.77.232.244:5432";
  const tenantUrl = `${baseUrl}/${dbName}?schema=public`;

  const client = new PrismaClient({
    datasources: {
      db: {
        url: tenantUrl,
      },
    },
    log: env.NODE_ENV === 'dev' ? ['query'] : [],
  });

  prismaClients.set(cacheKey, client);
  return client;
}

export async function getEurecaPrisma(): Promise<PrismaClient> {
  try {
    const fromDomain = await getPrismaForDomain('eureca.metrics.dev.br');
    if (fromDomain) return fromDomain;
  } catch (e: any) {
    console.warn('[TenantManager] Fallback para conexão direta db_eureca:', e.message);
  }
  return getPrismaForDb('db_eureca');
}
