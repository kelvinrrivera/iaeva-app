/**

if (process.env.NODE_ENV === 'production') {
  console.error("ERROR: This debug script must not run in production.");
  process.exit(1);
}
 * Fix User IDs - Match Prisma User IDs with Supabase Auth IDs
 *
 * This script fixes the mismatch between seeded User IDs (like org-admin-001)
 * and Supabase Auth UUIDs by updating the Prisma User records.
 *
 * Run: pnpm tsx scripts/fix-user-ids.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../lib/db';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Users from seed that need ID fixing
const SEEDED_USERS = [
  { email: 'miguel.barberia@domicitas.do', oldId: 'org-admin-001' },
  { email: 'ana.belleza@domicitas.do', oldId: 'org-admin-002' },
  { email: 'ana.estilista@domicitas.do', oldId: 'org-admin-003' },
  { email: 'carlos.hibrido@domicitas.do', oldId: 'org-admin-004' },
  { email: 'maria.equipo@domicitas.do', oldId: 'team-leader-001' },
  { email: 'jose.sucursal@domicitas.do', oldId: 'team-leader-002' },
  { email: 'rafael.barbero@domicitas.do', oldId: 'prof-001' },
  { email: 'daniela.estilista@domicitas.do', oldId: 'prof-002' },
  { email: 'pedro.barbero@domicitas.do', oldId: 'prof-003' },
  { email: 'sofia.estilista@domicitas.do', oldId: 'prof-004' },
  { email: 'andres.barbero@domicitas.do', oldId: 'prof-005' },
];

async function main() {
  console.log('🔧 Fixing User IDs to match Supabase Auth...\n');

  let fixedCount = 0;
  let notFoundCount = 0;
  let alreadyMatchedCount = 0;

  for (const seededUser of SEEDED_USERS) {
    try {
      console.log(`📧 Processing: ${seededUser.email}`);

      // 1. Get Supabase Auth user by email
      const { data: { users }, error } = await supabase.auth.admin.listUsers();

      if (error) {
        console.log(`   ❌ Error listing users: ${error.message}`);
        continue;
      }

      const authUser = users?.find(u => u.email === seededUser.email);

      if (!authUser) {
        console.log(`   ⚠️  Not found in Supabase Auth - skipping`);
        notFoundCount++;
        continue;
      }

      const supabaseId = authUser.id;

      // 2. Check if Prisma user exists
      const prismaUser = await prisma.user.findUnique({
        where: { email: seededUser.email },
        include: { memberships: true }
      });

      if (!prismaUser) {
        console.log(`   ⚠️  Not found in Prisma - skipping`);
        notFoundCount++;
        continue;
      }

      // 3. Check if IDs already match
      if (prismaUser.id === supabaseId) {
        console.log(`   ✅ IDs already match - no change needed`);
        alreadyMatchedCount++;
        continue;
      }

      console.log(`   📝 Old Prisma ID: ${prismaUser.id}`);
      console.log(`   📝 Supabase Auth ID: ${supabaseId}`);

      // 4. Delete the old user and create new one with correct ID
      // (We can't update ID directly due to foreign keys)

      console.log(`   🔑 Updating ID...`);

      // Use raw SQL to bypass Prisma's safety checks
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET id = $1 WHERE id = $2`,
        supabaseId, prismaUser.id
      );

      console.log(`   ✅ Fixed!\n`);
      fixedCount++;

    } catch (err: any) {
      console.log(`   ❌ Error: ${err.message}\n`);
    }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ User ID Fix Complete!');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`📊 Summary:`);
  console.log(`   ✅ Fixed: ${fixedCount}`);
  console.log(`   ✓ Already matched: ${alreadyMatchedCount}`);
  console.log(`   ⚠️  Not found: ${notFoundCount}`);
  console.log(`   📧 Total: ${SEEDED_USERS.length}\n`);
}

main()
  .catch((err) => {
    console.error('❌ Fatal Error:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
