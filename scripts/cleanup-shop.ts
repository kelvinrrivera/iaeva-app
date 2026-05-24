/**
 * Cleanup script for testing — deletes a shop and all related data.
 *
 * Usage:
 *   npx tsx scripts/cleanup-shop.ts --phone +33668051125       # by user phone
 *   npx tsx scripts/cleanup-shop.ts --shop cmmhwewpd000004...  # by shop ID
 *   npx tsx scripts/cleanup-shop.ts --phone +33668051125 --delete-user  # also delete the user
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { Pool } from "pg";

// Auto-load .env
try {
  const envPath = resolve(__dirname, "../.env");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    let val = trimmed.slice(eqIdx + 1);
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env not found — rely on existing env vars
}

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const phoneArg = getArg("--phone");
const shopIdArg = getArg("--shop");
const deleteUser = args.includes("--delete-user");

if (!phoneArg && !shopIdArg) {
  console.log("Usage:");
  console.log("  npx tsx scripts/cleanup-shop.ts --phone +33668051125");
  console.log("  npx tsx scripts/cleanup-shop.ts --shop <shopId>");
  console.log("  npx tsx scripts/cleanup-shop.ts --phone +33668051125 --delete-user");
  process.exit(1);
}

const connString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connString) {
  console.error("ERROR: DIRECT_URL or DATABASE_URL must be set");
  process.exit(1);
}

const pool = new Pool({ connectionString: connString });

// Tables that reference Shop via shopId, in safe delete order
const SHOP_DEPENDENT_TABLES = [
  "AppointmentService",  // depends on Appointment
  "Appointment",
  "WalkIn",
  "Service",
  "Stylist",
  "Client",
  "Membership",
  "Team",
  "Invitation",
  "ShopAvailability",
  "FAQ",
  "UsageStats",
  "Location",
  "Schedule",
  "ReminderConfig",
  "LoyaltyConfig",
  "WhatsAppConfig",
  "WhatsAppConversation",
  "WhatsAppTemplate",
  "NotificationLog",
];

async function main() {
  const client = await pool.connect();
  try {
    let shopIds: string[] = [];
    let userId: string | null = null;

    if (phoneArg) {
      // Normalize: strip non-digits except leading +
      const phone = phoneArg.startsWith("+") ? phoneArg : `+${phoneArg}`;
      const phoneDigits = phone.replace(/\D/g, "");

      // Try exact match first, then without +
      const res = await client.query(
        `SELECT id, name, "phoneNumber", email FROM "User" WHERE "phoneNumber" = $1 OR "phoneNumber" = $2`,
        [phone, phoneDigits]
      );

      if (res.rows.length === 0) {
        console.log(`No user found with phone ${phone} or ${phoneDigits}`);
        return;
      }

      const user = res.rows[0];
      userId = user.id;
      console.log(`Found user: ${user.name || "(no name)"} | ${user.phoneNumber} | id: ${user.id}`);

      // Get their shops
      const memberships = await client.query(
        `SELECT m."shopId", m.role, s.name FROM "Membership" m JOIN "Shop" s ON s.id = m."shopId" WHERE m."userId" = $1`,
        [userId]
      );

      if (memberships.rows.length === 0) {
        console.log("User has no shop memberships.");
        if (deleteUser) {
          await client.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
          console.log("Deleted user.");
        }
        return;
      }

      console.log("\nShops:");
      memberships.rows.forEach((m: any) => console.log(`  - ${m.name} (${m.shopId}) [${m.role}]`));
      shopIds = memberships.rows.map((m: any) => m.shopId);

    } else if (shopIdArg) {
      const res = await client.query(`SELECT id, name FROM "Shop" WHERE id = $1`, [shopIdArg]);
      if (res.rows.length === 0) {
        console.log(`No shop found with id ${shopIdArg}`);
        return;
      }
      console.log(`Found shop: ${res.rows[0].name} (${res.rows[0].id})`);
      shopIds = [shopIdArg];
    }

    // Delete each shop and all dependent data
    for (const shopId of shopIds) {
      console.log(`\n--- Cleaning shop ${shopId} ---`);

      for (const table of SHOP_DEPENDENT_TABLES) {
        try {
          // AppointmentService references Appointment, not Shop directly
          if (table === "AppointmentService") {
            const r = await client.query(
              `DELETE FROM "AppointmentService" WHERE "appointmentId" IN (SELECT id FROM "Appointment" WHERE "shopId" = $1)`,
              [shopId]
            );
            if (r.rowCount && r.rowCount > 0) console.log(`  ${table}: ${r.rowCount} deleted`);
          } else {
            const r = await client.query(`DELETE FROM "${table}" WHERE "shopId" = $1`, [shopId]);
            if (r.rowCount && r.rowCount > 0) console.log(`  ${table}: ${r.rowCount} deleted`);
          }
        } catch {
          // Table might not exist or no shopId column — skip silently
        }
      }

      const shopDel = await client.query(`DELETE FROM "Shop" WHERE id = $1`, [shopId]);
      console.log(`  Shop: deleted (${shopDel.rowCount})`);
    }

    // Optionally delete user
    if (deleteUser && userId) {
      await client.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
      console.log(`\nUser ${userId} deleted.`);
    }

    console.log("\nDone!");

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
