import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  
  // During build time, use a dummy connection string to avoid errors
  // The client won't actually connect until it's used at runtime
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';
  
  if (!connectionString || isBuildTime) {
    // Use a valid PostgreSQL connection string format that won't connect
    // This allows Prisma client generation during build
    const dummyUrl = 'postgresql://user:password@localhost:5432/dummy?schema=public';
    try {
      // Create adapter with dummy URL - it won't connect until used
      const pool = new Pool({ connectionString: dummyUrl });
      const adapter = new PrismaPg(pool);
      return new PrismaClient({
        adapter,
        log: [],
        datasources: {
          db: { url: dummyUrl },
        },
      });
    } catch (error) {
      // Fallback: create client without adapter during build
      return new PrismaClient({
        datasources: {
          db: { url: dummyUrl },
        },
        log: [],
      }) as any;
    }
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
