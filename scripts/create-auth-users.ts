/**
 * Create Supabase Auth Users
 *
 * This script creates all the seeded users in Supabase Auth
 * with a temporary password so they can log in.
 *
 * Run: pnpm tsx scripts/create-auth-users.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

if (process.env.NODE_ENV === 'production') {
  console.error('ERROR: This seed script must not run in production.');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!process.env.SEED_PASSWORD) {
  console.error('❌ SEED_PASSWORD env var is required — refusing to use a hardcoded default.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TEMP_PASSWORD = process.env.SEED_PASSWORD;

// Users to create in Supabase Auth
const users = [
  // SUPER_ADMIN
  {
    email: 'admin@domicitas.do',
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: 'Carlos Rodríguez',
      role: 'SUPER_ADMIN',
    }
  },

  // ORG_ADMINS
  {
    email: 'miguel.barberia@domicitas.do',
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: 'Miguel Ángel Rodríguez Pérez',
      role: 'ORG_ADMIN',
      shop_id: 'shop-barber-free',
    }
  },
  {
    email: 'ana.belleza@domicitas.do',
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: 'Ana Sofía Martínez García',
      role: 'ORG_ADMIN',
      shop_id: 'shop-beauty-pro',
    }
  },
  {
    email: 'luis.uñas@domicitas.do',
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: 'Luis Manuel Sánchez Flores',
      role: 'ORG_ADMIN',
      shop_id: 'shop-nail-pro',
    }
  },
  {
    email: 'carlos.hibrido@domicitas.do',
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: 'Carlos Eduardo Ramírez Luna',
      role: 'ORG_ADMIN',
      shop_id: 'shop-hybrid-enterprise',
    }
  },

  // TEAM_LEADERS
  {
    email: 'maria.equipo@domicitas.do',
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: 'María Gabriela Hernández Cruz',
      role: 'TEAM_LEADER',
      shop_id: 'shop-barber-pro',
    }
  },
  {
    email: 'jose.sucursal@domicitas.do',
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: 'José María Torres Vargas',
      role: 'TEAM_LEADER',
      shop_id: 'shop-hybrid-enterprise',
    }
  },

  // PROFESSIONALS
  {
    email: 'rafael.barbero@domicitas.do',
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: 'Rafael Antonio Rodríguez Pérez',
      role: 'PROFESSIONAL',
      shop_id: 'shop-barber-free',
    }
  },
  {
    email: 'daniela.estilista@domicitas.do',
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: 'Daniela Alejandra Sánchez Reyes',
      role: 'PROFESSIONAL',
      shop_id: 'shop-beauty-pro',
    }
  },
  {
    email: 'pedro.barbero@domicitas.do',
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: 'Pedro Miguel García Hernández',
      role: 'PROFESSIONAL',
      shop_id: 'shop-barber-pro',
    }
  },
  {
    email: 'sofia.manicura@domicitas.do',
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: 'Sofía Alejandra Flores Ramos',
      role: 'PROFESSIONAL',
      shop_id: 'shop-nail-pro',
    }
  },
  {
    email: 'andres.barbero@domicitas.do',
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: 'Andrés Felipe Luna Cruz',
      role: 'PROFESSIONAL',
      shop_id: 'shop-hybrid-enterprise',
    }
  },

  // CUSTOMERS
  {
    email: 'juan.cliente@gmail.com',
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: 'Juan Carlos Pérez Martínez',
      role: 'CUSTOMER',
    }
  },
  {
    email: 'laura.cliente@gmail.com',
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: 'Laura Isabel García Sánchez',
      role: 'CUSTOMER',
    }
  },
];

async function main() {
  console.log('🔐 Creating Supabase Auth Users...\n');
  console.log('📧 Using password from SEED_PASSWORD env var (not logged)\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  let successCount = 0;
  let errorCount = 0;

  for (const user of users) {
    try {
      console.log(`📧 Creating user: ${user.email}`);

      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: user.email_confirm,
        user_metadata: user.user_metadata,
      });

      if (error) {
        // Check if user already exists
        if (error.message.includes('already been registered')) {
          console.log(`   ⚠️  Already exists, skipping...\n`);

          // Try to update the user instead
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            data.user.id,
            {
              password: user.password,
              email_confirm: true,
              user_metadata: user.user_metadata,
            }
          );

          if (updateError) {
            console.log(`   ❌ Could not update: ${updateError.message}\n`);
            errorCount++;
          } else {
            console.log(`   ✅ Updated existing user\n`);
            successCount++;
          }
        } else {
          console.log(`   ❌ Error: ${error.message}\n`);
          errorCount++;
        }
      } else {
        console.log(`   ✅ Created - ID: ${data.user.id}`);
        console.log(`   👤 Name: ${user.user_metadata.name}`);
        console.log(`   🔑 Role: ${user.user_metadata.role}\n`);
        successCount++;
      }
    } catch (err: any) {
      console.log(`   ❌ Exception: ${err.message}\n`);
      errorCount++;
    }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Supabase Auth Users Creation Complete!');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📧 Total Users: ${users.length}`);
  console.log('\n📖 See CREDENCIALES_TESTING.md for complete login credentials\n');
}

main()
  .catch((err) => {
    console.error('❌ Fatal Error:', err);
    process.exit(1);
  });
