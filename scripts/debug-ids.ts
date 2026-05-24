import { Pool } from "pg";

if (process.env.NODE_ENV === 'production') {
  console.error("ERROR: This debug script must not run in production.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DIRECT_URL });

async function main() {
  const client = await pool.connect();
  try {
    // Check Supabase auth.users
    const authUsers = await client.query(
      `SELECT id, phone, email FROM auth.users WHERE phone LIKE '%33668051%'`
    );
    console.log("Supabase Auth users:", authUsers.rows);

    // Check public.User
    const dbUsers = await client.query(
      `SELECT id, "phoneNumber", email, name FROM "User" WHERE "phoneNumber" LIKE '%33668051%'`
    );
    console.log("DB users:", dbUsers.rows);

    // Check memberships for both IDs
    if (dbUsers.rows.length > 0) {
      const m1 = await client.query(
        `SELECT "userId", "shopId", role FROM "Membership" WHERE "userId" = $1`,
        [dbUsers.rows[0].id]
      );
      console.log("Memberships by DB user ID:", m1.rows);
    }

    if (authUsers.rows.length > 0) {
      const supaId = authUsers.rows[0].id;
      const m2 = await client.query(
        `SELECT "userId", "shopId", role FROM "Membership" WHERE "userId" = $1`,
        [supaId]
      );
      console.log("Memberships by Supabase Auth ID:", m2.rows);

      // Are they different?
      if (dbUsers.rows.length > 0 && supaId !== dbUsers.rows[0].id) {
        console.log("\n*** ID MISMATCH ***");
        console.log("  Supabase Auth ID:", supaId);
        console.log("  DB User ID:      ", dbUsers.rows[0].id);
      } else {
        console.log("\nIDs match.");
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
