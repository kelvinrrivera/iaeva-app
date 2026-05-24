import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Renamed to 'db' to force a fresh import in environments with aggressive caching
const prismaClientSingleton = () => {
    // Supabase Pooler allows ~15 connections per project on the free tier.
    // Serverless = many instances, so keep per-instance pool small.
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
    });
    const adapter = new PrismaPg(pool);

    // Only enable query logging on a local dev machine.
    // Require NODE_ENV === 'development' AND opt-in flag to avoid leaking queries
    // from staging/preview deployments that may accidentally set NODE_ENV=development.
    const enableQueryLog =
        process.env.NODE_ENV === 'development' &&
        process.env.PRISMA_LOG_QUERIES === 'true';

    return new PrismaClient({
        adapter,
        log: enableQueryLog ? ['query', 'error', 'warn'] : ['error'],
    });
};

const globalForPrisma = globalThis as unknown as {
    db: PrismaClient | undefined;
};

export const db = globalForPrisma.db ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalForPrisma.db = db;
