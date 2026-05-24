/**
 * Update Twilio Content SIDs for existing templates
 *
 * Run: pnpm tsx scripts/update-twilio-templates.ts
 */

import { db } from '../lib/database';

const TEMPLATES = [
  {
    purpose: 'appointment_reminder_24h',
    twilioContentSid: 'HX4dc1be493c6f9829626ea1c3aab2f486',
    name: 'recordatorio_24h',
  },
  {
    purpose: 'appointment_reminder_6h',
    twilioContentSid: 'HX6482386efba3c1e901bc41beb6c50210',
    name: 'recordatorio_6h',
  },
  {
    purpose: 'appointment_reminder_2h',
    twilioContentSid: 'HX660389e29fd9a87fa08e6edc40382e61',
    name: 'recordatorio_2h',
  },
];

async function main() {
  console.log('Updating Twilio Content SIDs...');

  for (const tmpl of TEMPLATES) {
    // Find all templates with this purpose
    const templates = await db.whatsAppTemplate.findMany({
      where: { purpose: tmpl.purpose },
    });

    console.log(`Found ${templates.length} templates for ${tmpl.purpose}`);

    for (const t of templates) {
      await db.whatsAppTemplate.update({
        where: { id: t.id },
        data: {
          twilioContentSid: tmpl.twilioContentSid,
          status: 'APPROVED',
        },
      });
      console.log(`  Updated ${t.shopId}: ${tmpl.name} -> ${tmpl.twilioContentSid}`);
    }
  }

  console.log('Done!');
}

main().catch(console.error);
