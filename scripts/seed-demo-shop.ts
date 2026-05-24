/**
 * Seed: Negocio de demostración para la landing page
 *
 * Crea (o actualiza) un shop demo con datos realistas de una barbería en RD.
 * NO borra datos existentes — solo hace upsert del negocio demo.
 *
 * Uso: npx tsx scripts/seed-demo-shop.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEMO_SHOP_ID = 'demo-shop-barberia-elite';
const DEMO_STYLIST_1_ID = 'demo-stylist-carlos';
const DEMO_STYLIST_2_ID = 'demo-stylist-rafael';

async function main() {
  console.log('🎭 Creando negocio de demostración...\n');

  // ── 1. Shop ──────────────────────────────────────────────────
  const shop = await prisma.shop.upsert({
    where: { id: DEMO_SHOP_ID },
    update: {
      name: 'Barbería Elite (Demo)',
      address: 'Piantini, Calle 15, Santo Domingo',
      whatsappEnabled: true,
      plan: 'PROFESSIONAL' as any,
      shopType: 'BARBERSHOP' as any,
    },
    create: {
      id: DEMO_SHOP_ID,
      name: 'Barbería Elite (Demo)',
      address: 'Piantini, Calle 15, Santo Domingo',
      phoneNumber: '809-555-0101',
      whatsappEnabled: true,
      plan: 'PROFESSIONAL' as any,
      shopType: 'BARBERSHOP' as any,
      timezone: 'America/Santo_Domingo',
      currency: 'DOP',
      language: 'es',
    },
  });
  console.log(`✅ Shop: ${shop.name}`);

  // ── 2. Servicios ─────────────────────────────────────────────
  const serviceData = [
    { name: 'Corte Clásico',        price: 500,  duration: 30, description: 'Corte tradicional con tijera y máquina' },
    { name: 'Fade / Degradado',     price: 700,  duration: 45, description: 'Degradado profesional bajo, medio o alto' },
    { name: 'Corte + Barba',        price: 900,  duration: 50, description: 'Corte completo más perfilado de barba' },
    { name: 'Recorte de Barba',     price: 350,  duration: 20, description: 'Perfilado y recorte de barba con navaja' },
    { name: 'Barba Hot Towel',      price: 600,  duration: 30, description: 'Rasurado con toalla caliente y navaja tradicional' },
    { name: 'Diseño de Líneas',     price: 400,  duration: 20, description: 'Diseño personalizado de líneas y patrones' },
    { name: 'Corte Infantil',       price: 400,  duration: 25, description: 'Corte para niños hasta 12 años' },
    { name: 'Tratamiento Capilar',  price: 800,  duration: 40, description: 'Hidratación profunda y nutrición del cabello' },
  ];

  for (const svc of serviceData) {
    await prisma.service.upsert({
      where: {
        // Use a composite if available, otherwise just create
        id: `demo-svc-${svc.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
      },
      update: { price: svc.price, duration: svc.duration },
      create: {
        id: `demo-svc-${svc.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
        name: svc.name,
        description: svc.description,
        price: svc.price,
        duration: svc.duration,
        serviceType: 'HAIRCUT' as any,
        shopId: DEMO_SHOP_ID,
        isActive: true,
        isBookable: true,
      },
    });
  }
  console.log(`✅ Servicios: ${serviceData.length} creados`);

  // ── 3. Estilistas ─────────────────────────────────────────────
  await prisma.stylist.upsert({
    where: { id: DEMO_STYLIST_1_ID },
    update: {},
    create: {
      id: DEMO_STYLIST_1_ID,
      name: 'Carlos Méndez',
      email: 'carlos.demo@domicita.do',
      shopId: DEMO_SHOP_ID,
    },
  });

  await prisma.stylist.upsert({
    where: { id: DEMO_STYLIST_2_ID },
    update: {},
    create: {
      id: DEMO_STYLIST_2_ID,
      name: 'Rafael Torres',
      email: 'rafael.demo@domicita.do',
      shopId: DEMO_SHOP_ID,
    },
  });
  console.log(`✅ Estilistas: Carlos Méndez, Rafael Torres`);

  // ── 4. Horarios del shop ──────────────────────────────────────
  // Borrar y recrear para este shop
  await prisma.shopAvailability.deleteMany({ where: { shopId: DEMO_SHOP_ID } });
  await prisma.shopAvailability.createMany({
    data: [
      { shopId: DEMO_SHOP_ID, dayOfWeek: 1, startTime: '09:00', endTime: '21:00' },
      { shopId: DEMO_SHOP_ID, dayOfWeek: 2, startTime: '09:00', endTime: '21:00' },
      { shopId: DEMO_SHOP_ID, dayOfWeek: 3, startTime: '09:00', endTime: '21:00' },
      { shopId: DEMO_SHOP_ID, dayOfWeek: 4, startTime: '09:00', endTime: '21:00' },
      { shopId: DEMO_SHOP_ID, dayOfWeek: 5, startTime: '09:00', endTime: '22:00' },
      { shopId: DEMO_SHOP_ID, dayOfWeek: 6, startTime: '09:00', endTime: '22:00' },
      { shopId: DEMO_SHOP_ID, dayOfWeek: 0, startTime: '10:00', endTime: '18:00' },
    ],
  });
  console.log(`✅ Horarios configurados (Lun-Dom)`);

  // ── 5. Disponibilidad de estilistas ───────────────────────────
  for (const stylistId of [DEMO_STYLIST_1_ID, DEMO_STYLIST_2_ID]) {
    await prisma.availability.deleteMany({ where: { stylistId } });
    await prisma.availability.createMany({
      data: [
        { stylistId, dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
        { stylistId, dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
        { stylistId, dayOfWeek: 3, startTime: '09:00', endTime: '18:00' },
        { stylistId, dayOfWeek: 4, startTime: '09:00', endTime: '18:00' },
        { stylistId, dayOfWeek: 5, startTime: '09:00', endTime: '19:00' },
        { stylistId, dayOfWeek: 6, startTime: '10:00', endTime: '20:00' },
      ],
    });
  }
  console.log(`✅ Disponibilidad de estilistas configurada`);

  // ── 6. Algunas citas de ejemplo (para que el motor de optimización tenga datos) ──
  // Solo crear si no hay citas ya
  const existingAppts = await prisma.appointment.count({ where: { shopId: DEMO_SHOP_ID } });
  if (existingAppts === 0) {
    const services = await prisma.service.findMany({ where: { shopId: DEMO_SHOP_ID } });
    const svc1 = services[0];
    const svc2 = services[2];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.appointment.createMany({
      data: [
        // Hoy
        {
          clientName: 'Juan Pérez',
          clientWhatsApp: '809-555-0201',
          stylistId: DEMO_STYLIST_1_ID,
          serviceId: svc1.id,
          shopId: DEMO_SHOP_ID,
          startTime: new Date(today.getTime() + 10 * 3600000),
          endTime:   new Date(today.getTime() + 10.5 * 3600000),
          status: 'CONFIRMED' as any,
        },
        {
          clientName: 'Miguel Santos',
          clientWhatsApp: '809-555-0202',
          stylistId: DEMO_STYLIST_1_ID,
          serviceId: svc2.id,
          shopId: DEMO_SHOP_ID,
          startTime: new Date(today.getTime() + 14 * 3600000),
          endTime:   new Date(today.getTime() + 14.75 * 3600000),
          status: 'SCHEDULED' as any,
        },
        // Mañana
        {
          clientName: 'Pedro Díaz',
          clientWhatsApp: '809-555-0203',
          stylistId: DEMO_STYLIST_2_ID,
          serviceId: svc1.id,
          shopId: DEMO_SHOP_ID,
          startTime: new Date(today.getTime() + 25 * 3600000),
          endTime:   new Date(today.getTime() + 25.5 * 3600000),
          status: 'SCHEDULED' as any,
        },
      ],
    });
    console.log(`✅ Citas de ejemplo creadas`);
  } else {
    console.log(`ℹ️  Ya existen ${existingAppts} citas, no se recrean`);
  }

  console.log(`
═══════════════════════════════════════════
✅ Negocio demo listo
═══════════════════════════════════════════
🏪 Shop ID:    ${DEMO_SHOP_ID}
✂️  Estilistas: Carlos Méndez, Rafael Torres
💈 Servicios:  ${serviceData.length}
🕐 Horario:   Lun-Vie 9-21h | Sáb 9-22h | Dom 10-18h

Variable de entorno recomendada:
DEMO_SHOP_ID=${DEMO_SHOP_ID}
═══════════════════════════════════════════
  `);
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
