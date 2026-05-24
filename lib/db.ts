// Consolidated: single Prisma client lives in lib/database.ts
// This file re-exports as `prisma` for backwards compatibility
import { db } from './database';

export const prisma = db;
