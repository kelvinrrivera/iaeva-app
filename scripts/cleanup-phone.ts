import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PHONE = "33668051125";

async function main() {
  // Find user
  const user = await prisma.user.findUnique({
    where: { phoneNumber: PHONE },
    include: {
      memberships: { include: { shop: true } },
    },
  });

  if (!user) {
    console.log("No user found with phone", PHONE);
    return;
  }

  console.log("Found user:", { id: user.id, name: user.name, phone: user.phoneNumber });
  console.log("Memberships:", user.memberships.map(m => ({ role: m.role, shopId: m.shopId, shopName: m.shop?.name })));

  const shopIds = user.memberships.map(m => m.shopId);
  console.log("Shop IDs to clean:", shopIds);

  for (const shopId of shopIds) {
    console.log(`\nCleaning shop ${shopId}...`);

    const delAppointmentServices = await prisma.appointmentService.deleteMany({ where: { appointment: { shopId } } });
    console.log("  Deleted appointmentServices:", delAppointmentServices.count);

    const delAppointments = await prisma.appointment.deleteMany({ where: { shopId } });
    console.log("  Deleted appointments:", delAppointments.count);

    const delWalkIns = await prisma.walkIn.deleteMany({ where: { shopId } });
    console.log("  Deleted walkIns:", delWalkIns.count);

    const delServices = await prisma.service.deleteMany({ where: { shopId } });
    console.log("  Deleted services:", delServices.count);

    const delStylists = await prisma.stylist.deleteMany({ where: { shopId } });
    console.log("  Deleted stylists:", delStylists.count);

    const delClients = await prisma.client.deleteMany({ where: { shopId } });
    console.log("  Deleted clients:", delClients.count);

    const delMemberships = await prisma.membership.deleteMany({ where: { shopId } });
    console.log("  Deleted memberships:", delMemberships.count);

    const delSchedules = await prisma.schedule.deleteMany({ where: { shopId } });
    console.log("  Deleted schedules:", delSchedules.count);

    const delReminderConfigs = await prisma.reminderConfig.deleteMany({ where: { shopId } });
    console.log("  Deleted reminderConfigs:", delReminderConfigs.count);

    const delWhatsappConfigs = await prisma.whatsAppConfig.deleteMany({ where: { shopId } });
    console.log("  Deleted whatsappConfigs:", delWhatsappConfigs.count);

    const delConversations = await prisma.whatsAppConversation.deleteMany({ where: { shopId } });
    console.log("  Deleted whatsappConversations:", delConversations.count);

    const delNotifications = await prisma.notificationLog.deleteMany({ where: { shopId } });
    console.log("  Deleted notificationLogs:", delNotifications.count);

    const delShop = await prisma.shop.delete({ where: { id: shopId } });
    console.log("  Deleted shop:", delShop.name);
  }

  // Delete the user
  const delUser = await prisma.user.delete({ where: { id: user.id } });
  console.log("\nDeleted user:", delUser.name, delUser.phoneNumber);
  console.log("\nDone! User and all associated shops cleaned up.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
