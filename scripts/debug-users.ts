/**

if (process.env.NODE_ENV === 'production') {
  console.error("ERROR: This debug script must not run in production.");
  process.exit(1);
}
 * Debug Users - Check user IDs and memberships
 *
 * Run: pnpm tsx scripts/debug-users.ts
 */

import 'dotenv/config';
import { prisma } from '../lib/db';

async function main() {
  console.log('🔍 Debugging Users and Memberships...\n');

  // Check specific users
  const targetEmails = ['miguel.barberia@domicitas.do', 'carlos.hibrido@domicitas.do'];

  console.log('🎯 Target Users Check:\n');

  for (const email of targetEmails) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { shop: true }
        }
      }
    });

    if (user) {
      console.log(`✅ ${email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Memberships: ${user.memberships.length}`);

      if (user.memberships.length === 0) {
        console.log(`   ❌ PROBLEM: NO MEMBERSHIPS!`);
      } else {
        for (const m of user.memberships) {
          console.log(`      - ${m.role} @ ${m.shop?.name} (${m.shop?.plan})`);
        }
      }
    } else {
      console.log(`❌ ${email} - NOT FOUND IN PRISMA`);
    }
    console.log('');
  }

  await prisma.$disconnect();
}

main()
  .catch((err) => {
    console.error('❌ Fatal Error:', err);
    process.exit(1);
  });
