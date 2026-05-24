/**
 * Seed Script for Domicitas
 *
 * Populates the database with realistic data from Dominican Republic
 * for testing all functionality across all roles and shop types.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Plan, Role, ShopType, ServiceType, AppointmentStatus } from '@prisma/client';

// Configure Prisma with PostgreSQL adapter (same as lib/db.ts)
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['query', 'error', 'warn'],
});

// ==========================================
// DOMINICAN REPUBLIC DATA
// ==========================================

const DOMINICAN_NAMES = {
  male: [
    'Miguel Ángel', 'Juan Carlos', 'Luis Manuel', 'José María', 'Ramón Antonio',
    'Francisco Javier', 'Carlos Eduardo', 'Jorge Luis', 'Rafael Antonio', 'Pedro Miguel',
    'Manuel Alejandro', 'Roberto Carlos', 'Andrés Felipe', 'Diego Alejandro', 'Santiago',
    'Sebastián', 'Mateo', 'Leonardo', 'Daniel', 'Gabriel'
  ],
  female: [
    'María Gabriela', 'Ana Sofía', 'Isabella Victoria', 'Valentina', 'Camila',
    'Sofía Alejandra', 'María José', 'Lucía', 'Valeria', 'Martina',
    'María Fernanda', 'Isabella', 'Emilia', 'Victoria', 'Ximena',
    'Daniela', 'Gabriela', 'Alejandra', 'María Camila', 'Renata'
  ]
};

const DOMINICAN_SURNAMES = [
  'Rodríguez', 'Pérez', 'Martínez', 'García', 'Hernández',
  'Sánchez', 'Rivera', 'Torres', 'Flores', 'Ramírez',
  'Reyes', 'González', 'Díaz', 'Morales', 'Luna',
  'Cruz', 'Ortiz', 'Gómez', 'Castillo', 'Vargas'
];

const DOMINICAN_CITIES = [
  'Santo Domingo', 'Santiago', 'Santo Domingo Este', 'San Pedro de Macorís',
  'San Cristóbal', 'La Vega', 'Puerto Plata', 'Duarte', 'La Altagracia',
  'San Juan de la Maguana', 'Barahona', 'San Francisco de Macorís', 'Moca'
];

const DOMINICAN_NEIGHBORHOODS: Record<string, string[]> = {
  'Santo Domingo': ['Piantini', 'Naco', 'Bella Vista', 'Los Prados', 'Ensanche Paraíso', 'Evaristo Morales', 'Gascue'],
  'Santiago': ['Los Jardines', 'Metropolitano', 'Centro del Atlántico', 'Pekín', 'La Esperilla'],
  'Santo Domingo Este': ['Los Mina', 'Villa Mella', 'San Isidro', 'Hato Mayor'],
};

// ==========================================
// SHOP NAMES BY TYPE
// ==========================================

const SHOP_NAMES = {
  BARBERSHOP: [
    "Barbería El Caballero", "Corte Clase", "La Barbería de Piantini",
    "Estilo Dominicano", "Corte Perfecto SD", "Barbería Santiago Premium",
    "Estilo Capital", "La Barbería del Pueblo", "Corte Moderno"
  ],
  BEAUTY_SALON: [
    "Belleza Premium", "Salón Victoria", "Estilo Glamour",
    "La Belleza de Gabriela", "Salón Piantini", "Belleza Caribe",
    "Estilo Sofía", "Salón Elegante", "Belleza Natural"
  ],
  HYBRID: [
    "Salón Unisex Elite", "Estilo Unisex", "Unisex Beauty",
    "Salón Mixto", "Unisex Studio", "Belleza Unisex",
    "Salón Completo", "Unisex Style", "Estilo Total"
  ]
};

// ==========================================
// SERVICES BY TYPE
// ==========================================

const SERVICES = {
  HAIRCUT: [
    { name: 'Corte Clásico', price: 500, duration: 30 },
    { name: 'Corte Moderno', price: 700, duration: 45 },
    { name: 'Corte Premium', price: 1000, duration: 60 },
    { name: 'Corte Infantil', price: 400, duration: 25 },
    { name: 'Corte + Barba', price: 800, duration: 45 },
    { name: 'Degradado', price: 600, duration: 40 },
    { name: 'Diseño Especial', price: 1200, duration: 60 }
  ],
  BEARD: [
    { name: 'Recorte de Barba', price: 300, duration: 20 },
    { name: 'Perfilado de Barba', price: 400, duration: 25 },
    { name: 'Barba Hot Towel', price: 600, duration: 30 },
    { name: 'Rasurado Tradicional', price: 500, duration: 30 }
  ],
  COLOR: [
    { name: 'Tinte Completo', price: 2500, duration: 120 },
    { name: 'Mechas', price: 3500, duration: 180 },
    { name: 'Balayage', price: 4000, duration: 210 },
    { name: 'Tinte Raíz', price: 1500, duration: 90 },
    { name: 'Decoloración', price: 2000, duration: 120 }
  ],
  STYLING: [
    { name: 'Secado y Peinado', price: 800, duration: 45 },
    { name: 'Alisado', price: 3500, duration: 180 },
    { name: 'Rulos', price: 2500, duration: 150 },
    { name: 'Tratamiento Keratina', price: 4000, duration: 120 },
    { name: 'Botox Capilar', price: 3000, duration: 90 }
  ],
  FACIAL: [
    { name: 'Limpieza Facial', price: 1500, duration: 60 },
    { name: 'Hidratación Facial', price: 2000, duration: 75 },
    { name: 'Masaje Facial', price: 1200, duration: 45 },
    { name: 'Tratamiento Acné', price: 2500, duration: 90 }
  ],
  TREATMENT: [
    { name: 'Tratamiento Capilar', price: 2000, duration: 90 },
    { name: 'Hidratación Profunda', price: 1500, duration: 60 },
    { name: 'Botox Capilar', price: 3000, duration: 90 },
    { name: 'Reparación Cabello', price: 2500, duration: 75 }
  ]
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomPhoneNumber(): string {
  return `809-${getRandomNumber(100, 999)}-${getRandomNumber(1000, 9999)}`;
}

function getRandomWhatsAppNumber(): string {
  return `+1${getRandomNumber(809, 829)}-${getRandomNumber(100, 999)}-${getRandomNumber(1000, 9999)}`;
}

function generateFullName(gender: 'male' | 'female'): string {
  const firstName = getRandomElement(DOMINICAN_NAMES[gender]);
  const firstSurname = getRandomElement(DOMINICAN_SURNAMES);
  const secondSurname = getRandomElement(DOMINICAN_SURNAMES);
  return `${firstName} ${firstSurname} ${secondSurname}`;
}

function generateEmail(name: string, domain: string = 'gmail.com'): string {
  const cleanName = name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '.');
  return `${cleanName}.${getRandomNumber(100, 999)}@${domain}`;
}

function generateAddress(city: string): string {
  let neighborhoodList: string[];

  if (city === 'Santo Domingo') {
    neighborhoodList = ['Piantini', 'Naco', 'Bella Vista', 'Los Prados', 'Ensanche Paraíso', 'Evaristo Morales', 'Gascue'];
  } else if (city === 'Santiago') {
    neighborhoodList = ['Los Jardines', 'Metropolitano', 'Centro del Atlántico', 'Pekín', 'La Esperilla'];
  } else if (city === 'Santo Domingo Este') {
    neighborhoodList = ['Los Mina', 'Villa Mella', 'San Isidro', 'Hato Mayor'];
  } else {
    neighborhoodList = ['Piantini', 'Naco', 'Bella Vista', 'Los Prados'];
  }

  const neighborhood = neighborhoodList[Math.floor(Math.random() * neighborhoodList.length)];
  const street = ['Calle', 'Avenida', 'Paseo'][Math.floor(Math.random() * 3)];
  const number = Math.floor(Math.random() * 200) + 1;
  return `${neighborhood}, ${street} ${number}, ${city}`;
}

// ==========================================
// SEED DATA GENERATION
// ==========================================

async function main() {
  console.log('🌱 Seeding database with realistic Dominican Republic data...\n');

  // Clean existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.chatHistory.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.client.deleteMany();
  await prisma.timeBlock.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.stylist.deleteMany();
  await prisma.service.deleteMany();
  await prisma.shopAvailability.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.team.deleteMany();
  await (prisma as any).fAQ.deleteMany();  // FAQ model becomes fAQ in Prisma
  await prisma.usageStats.deleteMany();
  await prisma.location.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Cleaned existing data\n');

  // ==========================================
  // 1. CREATE USERS (All Roles)
  // ==========================================
  console.log('👥 Creating users...');

  const users = {
    superAdmin: await prisma.user.create({
      data: {
        id: 'super-admin-001',
        email: 'admin@domicitas.do',
        name: 'Carlos Rodríguez',
        phoneNumber: getRandomPhoneNumber(),
      }
    }),

    // ORG_ADMINS (Shop Owners)
    orgAdmins: [
      await prisma.user.create({
        data: {
          id: 'org-admin-001',
          email: 'miguel.barberia@domicitas.do',
          name: generateFullName('male'),
          phoneNumber: getRandomPhoneNumber(),
        }
      }),
      await prisma.user.create({
        data: {
          id: 'org-admin-002',
          email: 'ana.belleza@domicitas.do',
          name: generateFullName('female'),
          phoneNumber: getRandomPhoneNumber(),
        }
      }),
      await prisma.user.create({
        data: {
          id: 'org-admin-003',
          email: 'ana.estilista@domicitas.do',
          name: generateFullName('male'),
          phoneNumber: getRandomPhoneNumber(),
        }
      }),
      await prisma.user.create({
        data: {
          id: 'org-admin-004',
          email: 'carlos.hibrido@domicitas.do',
          name: generateFullName('male'),
          phoneNumber: getRandomPhoneNumber(),
        }
      }),
    ],

    // TEAM_LEADERS
    teamLeaders: [
      await prisma.user.create({
        data: {
          id: 'team-leader-001',
          email: 'maria.equipo@domicitas.do',
          name: generateFullName('female'),
          phoneNumber: getRandomPhoneNumber(),
        }
      }),
      await prisma.user.create({
        data: {
          id: 'team-leader-002',
          email: 'jose.sucursal@domicitas.do',
          name: generateFullName('male'),
          phoneNumber: getRandomPhoneNumber(),
        }
      }),
    ],

    // PROFESSIONALS (Stylists/Barbers)
    professionals: [
      await prisma.user.create({
        data: {
          id: 'prof-001',
          email: 'rafael.barbero@domicitas.do',
          name: generateFullName('male'),
          phoneNumber: getRandomPhoneNumber(),
        }
      }),
      await prisma.user.create({
        data: {
          id: 'prof-002',
          email: 'daniela.estilista@domicitas.do',
          name: generateFullName('female'),
          phoneNumber: getRandomPhoneNumber(),
        }
      }),
      await prisma.user.create({
        data: {
          id: 'prof-003',
          email: 'pedro.barbero@domicitas.do',
          name: generateFullName('male'),
          phoneNumber: getRandomPhoneNumber(),
        }
      }),
      await prisma.user.create({
        data: {
          id: 'prof-004',
          email: 'sofia.estilista@domicitas.do',
          name: generateFullName('female'),
          phoneNumber: getRandomPhoneNumber(),
        }
      }),
      await prisma.user.create({
        data: {
          id: 'prof-005',
          email: 'andres.barbero@domicitas.do',
          name: generateFullName('male'),
          phoneNumber: getRandomPhoneNumber(),
        }
      }),
    ],

    // CUSTOMERS
    customers: [
      await prisma.user.create({
        data: {
          id: 'customer-001',
          email: 'juan.cliente@gmail.com',
          name: generateFullName('male'),
          phoneNumber: getRandomPhoneNumber(),
        }
      }),
      await prisma.user.create({
        data: {
          id: 'customer-002',
          email: 'laura.cliente@gmail.com',
          name: generateFullName('female'),
          phoneNumber: getRandomPhoneNumber(),
        }
      }),
    ],
  };

  console.log(`✅ Created ${Object.keys(users).length} user groups\n`);

  // ==========================================
  // 2. CREATE SHOPS (All Types & Plans)
  // ==========================================
  console.log('🏪 Creating shops...');

  const shops = [
    // BARBERSHOP - FREE Plan
    await prisma.shop.create({
      data: {
        id: 'shop-barber-free',
        name: getRandomElement(SHOP_NAMES.BARBERSHOP),
        address: generateAddress('Santo Domingo'),
        phoneNumber: getRandomPhoneNumber(),
        whatsappNumber: getRandomWhatsAppNumber(),
        plan: 'FREE',
        shopType: 'BARBERSHOP',
        timezone: 'America/Santo_Domingo',
        currency: 'DOP',
        language: 'es',
      }
    }),

    // BARBERSHOP - PROFESSIONAL Plan
    await prisma.shop.create({
      data: {
        id: 'shop-barber-pro',
        name: getRandomElement(SHOP_NAMES.BARBERSHOP),
        address: generateAddress('Santiago'),
        phoneNumber: getRandomPhoneNumber(),
        whatsappNumber: getRandomWhatsAppNumber(),
        plan: 'PROFESSIONAL',
        shopType: 'BARBERSHOP',
        timezone: 'America/Santo_Domingo',
        currency: 'DOP',
        language: 'es',
        subscriptionStatus: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        stripeCustomerId: `cus_${Math.random().toString(36).substring(7)}`,
        stripeSubscriptionId: `sub_${Math.random().toString(36).substring(7)}`,
      }
    }),

    // BEAUTY_SALON - PROFESSIONAL Plan
    await prisma.shop.create({
      data: {
        id: 'shop-beauty-pro',
        name: getRandomElement(SHOP_NAMES.BEAUTY_SALON),
        address: generateAddress('Santo Domingo'),
        phoneNumber: getRandomPhoneNumber(),
        whatsappNumber: getRandomWhatsAppNumber(),
        plan: 'PROFESSIONAL',
        shopType: 'BEAUTY_SALON',
        timezone: 'America/Santo_Domingo',
        currency: 'DOP',
        language: 'es',
        subscriptionStatus: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }
    }),

    // HYBRID - ENTERPRISE Plan (Multi-location)
    await prisma.shop.create({
      data: {
        id: 'shop-hybrid-enterprise',
        name: getRandomElement(SHOP_NAMES.HYBRID),
        address: generateAddress('Santo Domingo'),
        phoneNumber: getRandomPhoneNumber(),
        whatsappNumber: getRandomWhatsAppNumber(),
        plan: 'ENTERPRISE',
        shopType: 'HYBRID',
        timezone: 'America/Santo_Domingo',
        currency: 'DOP',
        language: 'es',
        subscriptionStatus: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        stripeCustomerId: `cus_${Math.random().toString(36).substring(7)}`,
        stripeSubscriptionId: `sub_${Math.random().toString(36).substring(7)}`,
      }
    }),
  ];

  console.log(`✅ Created ${shops.length} shops\n`);

  // ==========================================
  // 3. CREATE LOCATIONS (For Enterprise Shop)
  // ==========================================
  console.log('📍 Creating locations...');

  const enterpriseShop = shops.find(s => s.plan === 'ENTERPRISE')!;
  const locations = await Promise.all([
    prisma.location.create({
      data: {
        shopId: enterpriseShop.id,
        name: 'Sucursal Piantini',
        address: generateAddress('Santo Domingo'),
        phoneNumber: getRandomPhoneNumber(),
        whatsappNumber: getRandomWhatsAppNumber(),
      }
    }),
    prisma.location.create({
      data: {
        shopId: enterpriseShop.id,
        name: 'Sucursal Santiago',
        address: generateAddress('Santiago'),
        phoneNumber: getRandomPhoneNumber(),
        whatsappNumber: getRandomWhatsAppNumber(),
      }
    }),
  ]);

  console.log(`✅ Created ${locations.length} locations\n`);

  // ==========================================
  // 4. CREATE MEMBERSHIPS (All Roles)
  // ==========================================
  console.log('🎫 Creating memberships...');

  // Super Admin Membership (to any shop)
  await prisma.membership.create({
    data: {
      userId: users.superAdmin.id,
      shopId: shops[0].id,
      role: 'SUPER_ADMIN',
    }
  });

  // ORG_ADMIN Memberships
  await prisma.membership.create({
    data: {
      userId: users.orgAdmins[0].id,
      shopId: shops[0].id, // BARBERSHOP FREE
      role: 'ORG_ADMIN',
    }
  });

  await prisma.membership.create({
    data: {
      userId: users.orgAdmins[1].id,
      shopId: shops[2].id, // BEAUTY_SALON PRO
      role: 'ORG_ADMIN',
    }
  });

  await prisma.membership.create({
    data: {
      userId: users.orgAdmins[2].id,
      shopId: shops[2].id, // BEAUTY_SALON PRO
      role: 'ORG_ADMIN',
    }
  });

  await prisma.membership.create({
    data: {
      userId: users.orgAdmins[3].id,
      shopId: shops[3].id, // HYBRID ENTERPRISE
      role: 'ORG_ADMIN',
    }
  });

  // TEAM_LEADER Memberships
  await prisma.membership.create({
    data: {
      userId: users.teamLeaders[0].id,
      shopId: shops[1].id, // BARBERSHOP PRO
      role: 'TEAM_LEADER',
    }
  });

  await prisma.membership.create({
    data: {
      userId: users.teamLeaders[1].id,
      shopId: shops[3].id, // HYBRID ENTERPRISE
      role: 'TEAM_LEADER',
    }
  });

  // PROFESSIONAL Memberships
  const professionalMemberships = await Promise.all([
    prisma.membership.create({
      data: {
        userId: users.professionals[0].id,
        shopId: shops[0].id,
        role: 'PROFESSIONAL',
      }
    }),
    prisma.membership.create({
      data: {
        userId: users.professionals[1].id,
        shopId: shops[2].id,
        role: 'PROFESSIONAL',
      }
    }),
    prisma.membership.create({
      data: {
        userId: users.professionals[2].id,
        shopId: shops[1].id,
        role: 'PROFESSIONAL',
      }
    }),
    prisma.membership.create({
      data: {
        userId: users.professionals[3].id,
        shopId: shops[2].id,
        role: 'PROFESSIONAL',
      }
    }),
    prisma.membership.create({
      data: {
        userId: users.professionals[4].id,
        shopId: shops[3].id,
        role: 'PROFESSIONAL',
      }
    }),
  ]);

  // CUSTOMER Memberships
  await prisma.membership.createMany({
    data: users.customers.map(customer => ({
      userId: customer.id,
      shopId: shops[getRandomNumber(0, shops.length - 1)].id,
      role: 'CUSTOMER',
    }))
  });

  console.log(`✅ Created memberships for all roles\n`);

  // ==========================================
  // 5. CREATE TEAMS
  // ==========================================
  console.log('👥 Creating teams...');

  await prisma.team.create({
    data: {
      name: 'Equipo Piantini',
      shopId: shops[1].id,
    }
  });

  await prisma.team.create({
    data: {
      name: 'Equipo Santiago',
      shopId: shops[3].id,
    }
  });

  console.log('✅ Created teams\n');

  // ==========================================
  // 6. CREATE SERVICES (For Each Shop Type)
  // ==========================================
  console.log('💅 Creating services...');

  for (const shop of shops) {
    const serviceTypes: ServiceType[] = [];

    switch (shop.shopType) {
      case 'BARBERSHOP':
        serviceTypes.push('HAIRCUT', 'BEARD');
        break;
      case 'BEAUTY_SALON':
        serviceTypes.push('COLOR', 'STYLING', 'FACIAL', 'TREATMENT');
        break;
      case 'HYBRID':
        serviceTypes.push('HAIRCUT', 'BEARD', 'COLOR', 'STYLING', 'FACIAL', 'TREATMENT');
        break;
    }

    for (const type of serviceTypes) {
      const services = SERVICES[type as keyof typeof SERVICES];
      const servicesToCreate = services.slice(0, getRandomNumber(2, services.length));

      await prisma.service.createMany({
        data: servicesToCreate.map(service => ({
          name: service.name,
          description: `Servicio profesional de ${service.name.toLowerCase()} en ${shop.name}`,
          price: service.price,
          duration: service.duration,
          serviceType: type,
          shopId: shop.id,
          isActive: true,
          isBookable: true,
        }))
      });
    }
  }

  console.log('✅ Created services for all shops\n');

  // ==========================================
  // 7. CREATE STYLISTS (With User Links)
  // ==========================================
  console.log('✂️  Creating stylists...');

  const stylists = await Promise.all([
    // Linked to professional users
    prisma.stylist.create({
      data: {
        name: users.professionals[0].name!,
        email: users.professionals[0].email,
        userId: users.professionals[0].id,
        shopId: shops[0].id,
      }
    }),
    prisma.stylist.create({
      data: {
        name: users.professionals[1].name!,
        email: users.professionals[1].email,
        userId: users.professionals[1].id,
        shopId: shops[2].id,
      }
    }),
    prisma.stylist.create({
      data: {
        name: users.professionals[2].name!,
        email: users.professionals[2].email,
        userId: users.professionals[2].id,
        shopId: shops[1].id,
        locationId: locations[0].id,
      }
    }),
    prisma.stylist.create({
      data: {
        name: users.professionals[3].name!,
        email: users.professionals[3].email,
        userId: users.professionals[3].id,
        shopId: shops[2].id,
      }
    }),
    prisma.stylist.create({
      data: {
        name: users.professionals[4].name!,
        email: users.professionals[4].email,
        userId: users.professionals[4].id,
        shopId: shops[3].id,
        locationId: locations[1].id,
      }
    }),

    // Additional stylists without user accounts
    ...[1, 2, 3, 4, 5].map(i =>
      prisma.stylist.create({
        data: {
          name: generateFullName(i % 2 === 0 ? 'male' : 'female'),
          email: generateEmail(`stylist${i}`),
          shopId: shops[getRandomNumber(0, shops.length - 1)].id,
          locationId: Math.random() > 0.5 ? locations[getRandomNumber(0, 1)].id : undefined,
        }
      })
    ),
  ]);

  console.log(`✅ Created ${stylists.length} stylists\n`);

  // ==========================================
  // 8. CREATE SHOP AVAILABILITY
  // ==========================================
  console.log('🕐 Creating shop availability...');

  for (const shop of shops) {
    await prisma.shopAvailability.createMany({
      data: [
        { shopId: shop.id, dayOfWeek: 1, startTime: '09:00', endTime: '21:00' }, // Monday
        { shopId: shop.id, dayOfWeek: 2, startTime: '09:00', endTime: '21:00' }, // Tuesday
        { shopId: shop.id, dayOfWeek: 3, startTime: '09:00', endTime: '21:00' }, // Wednesday
        { shopId: shop.id, dayOfWeek: 4, startTime: '09:00', endTime: '21:00' }, // Thursday
        { shopId: shop.id, dayOfWeek: 5, startTime: '09:00', endTime: '22:00' }, // Friday
        { shopId: shop.id, dayOfWeek: 6, startTime: '09:00', endTime: '22:00' }, // Saturday
        { shopId: shop.id, dayOfWeek: 0, startTime: '10:00', endTime: '18:00' }, // Sunday
      ]
    });
  }

  console.log('✅ Created shop availability\n');

  // ==========================================
  // 9. CREATE STYLIST AVAILABILITY
  // ==========================================
  console.log('🕐 Creating stylist availability...');

  for (const stylist of stylists) {
    await prisma.availability.createMany({
      data: [
        { stylistId: stylist.id, dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
        { stylistId: stylist.id, dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
        { stylistId: stylist.id, dayOfWeek: 3, startTime: '09:00', endTime: '18:00' },
        { stylistId: stylist.id, dayOfWeek: 4, startTime: '09:00', endTime: '18:00' },
        { stylistId: stylist.id, dayOfWeek: 5, startTime: '09:00', endTime: '19:00' },
        { stylistId: stylist.id, dayOfWeek: 6, startTime: '10:00', endTime: '20:00' },
      ]
    });
  }

  console.log('✅ Created stylist availability\n');

  // ==========================================
  // 10. CREATE CLIENTS
  // ==========================================
  console.log('👤 Creating clients...');

  const clientData = Array.from({ length: 30 }, () => ({
    name: generateFullName(Math.random() > 0.5 ? 'male' : 'female'),
    phoneNumber: getRandomPhoneNumber(),
    shopId: shops[getRandomNumber(0, shops.length - 1)].id,
    email: Math.random() > 0.3 ? generateEmail(`client${Math.random()}`) : null,
    preferredContact: 'WHATSAPP',
    isActive: true,
  }));

  const clients = await prisma.client.createMany({
    data: clientData
  });

  console.log(`✅ Created ${clients.count} clients\n`);

  // ==========================================
  // 11. CREATE APPOINTMENTS
  // ==========================================
  console.log('📅 Creating appointments...');

  // Get all services, stylists, and clients
  const allServices = await prisma.service.findMany();
  const allClients = await prisma.client.findMany({ take: 20 });

  const statuses: AppointmentStatus[] = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

  // Create appointments for the past, present, and future
  const appointments = [];
  const now = new Date();

  for (let i = 0; i < 50; i++) {
    const stylist = stylists[getRandomNumber(0, stylists.length - 1)];
    const shopServices = allServices.filter(s => s.shopId === stylist.shopId);
    const service = shopServices[getRandomNumber(0, shopServices.length - 1)];
    const client = allClients[getRandomNumber(0, allClients.length - 1)];

    // Random time within the past 30 days to next 30 days
    const daysOffset = getRandomNumber(-30, 30);
    const startTime = new Date(now);
    startTime.setDate(startTime.getDate() + daysOffset);
    startTime.setHours(getRandomNumber(9, 20), getRandomNumber(0, 59), 0, 0);

    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + service.duration);

    const status = daysOffset < -1 ?
      statuses[getRandomNumber(2, 4)] : // Past: COMPLETED, CANCELLED, NO_SHOW
      daysOffset > 1 ?
        statuses[getRandomNumber(0, 1)] : // Future: SCHEDULED, CONFIRMED
        'SCHEDULED'; // Today/Recent

    appointments.push({
      clientName: client.name,
      clientWhatsApp: client.phoneNumber,
      stylistId: stylist.id,
      serviceId: service.id,
      shopId: stylist.shopId,
      startTime,
      endTime,
      status,
      clientId: client.id,
      locationId: stylist.locationId,
    });
  }

  await prisma.appointment.createMany({
    data: appointments
  });

  console.log(`✅ Created ${appointments.length} appointments\n`);

  // ==========================================
  // 12. CREATE FAQS
  // ==========================================
  console.log('❓ Creating FAQs...');

  const faqs = [
    {
      question: '¿Cuáles son sus horarios de atención?',
      answer: 'Estamos abiertos de lunes a viernes de 9:00 AM a 9:00 PM, sábados de 9:00 AM a 10:00 PM y domingos de 10:00 AM a 6:00 PM.',
      shopId: shops[0].id
    },
    {
      question: '¿Cuánto cuesta un corte de cabello?',
      answer: 'Nuestros cortes comienzan desde RD$ 500. Los precios varían según el estilo y el barbero.',
      shopId: shops[0].id
    },
    {
      question: '¿Aceptan tarjetas de crédito?',
      answer: 'Sí, aceptamos todas las tarjetas de crédito, débito, transferencias y efectivo.',
      shopId: shops[0].id
    },
    {
      question: '¿Necesito reservar cita?',
      answer: 'Recomendamos reservar cita para evitar esperas, pero también aceptamos clientes sin cita según disponibilidad.',
      shopId: shops[0].id
    },
  ];

  await prisma.fAQ.createMany({
    data: faqs
  });

  console.log(`✅ Created ${faqs.length} FAQs\n`);

  // ==========================================
  // 13. CREATE USAGE STATS
  // ==========================================
  console.log('📊 Creating usage stats...');

  for (const shop of shops) {
    for (let month = 0; month < 3; month++) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - month);
      const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

      await prisma.usageStats.create({
        data: {
          shopId: shop.id,
          month: monthStr,
          appointmentsCreated: getRandomNumber(50, 500),
          whatsappMessagesSent: getRandomNumber(100, 1000),
          professionalsCount: getRandomNumber(1, shop.plan === 'ENTERPRISE' ? 20 : 5),
        }
      });
    }
  }

  console.log('✅ Created usage stats\n');

  // ==========================================
  // 14. CREATE INVITATIONS
  // ==========================================
  console.log('📧 Creating invitations...');

  await prisma.invitation.createMany({
    data: [
      {
        code: 'BARBER-2024-NEW',
        shopId: shops[0].id,
        role: 'PROFESSIONAL',
        email: 'nuevo.barbero@gmail.com',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        code: 'BEAUTY-TEAM-2024',
        shopId: shops[2].id,
        role: 'TEAM_LEADER',
        email: 'manager.belleza@gmail.com',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    ]
  });

  console.log('✅ Created invitations\n');

  // ==========================================
  // 15. CREATE CHAT HISTORY
  // ==========================================
  console.log('💬 Creating chat history...');

  const chatMessages = [
    { role: 'user', content: 'Hola, ¿cuáles son los precios de los cortes?' },
    { role: 'assistant', content: '¡Hola! 👋 Nuestros cortes comienzan desde RD$ 500. ¿Te gustaría agendar una cita?' },
    { role: 'user', content: 'Sí, ¿tienen disponibilidad para mañana?' },
    { role: 'assistant', content: '¡Por supuesto! ¿A qué hora te gustaría venir? Tenemos horarios de 9 AM a 9 PM.' },
  ];

  await prisma.chatHistory.createMany({
    data: chatMessages.map(msg => ({
      ...msg,
      phoneNumber: getRandomPhoneNumber(),
    }))
  });

  console.log(`✅ Created ${chatMessages.length} chat messages\n`);

  // ==========================================
  // SEEDING COMPLETE
  // ==========================================

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Seeding completed successfully!');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📊 Summary:');
  console.log(`   👥 Users: ${1 + users.orgAdmins.length + users.teamLeaders.length + users.professionals.length + users.customers.length}`);
  console.log(`   🏪 Shops: ${shops.length} (1 FREE, 2 PROFESSIONAL, 1 ENTERPRISE)`);
  console.log(`   📍 Locations: ${locations.length}`);
  console.log(`   👤 Stylists: ${stylists.length}`);
  console.log(`   💅 Services: ${allServices.length}`);
  console.log(`   👤 Clients: ${clients.count}`);
  console.log(`   📅 Appointments: ${appointments.length}`);
  console.log(`   ❓ FAQs: ${faqs.length}`);
  console.log('\n🎯 Role Coverage:');
  console.log(`   • SUPER_ADMIN: 1`);
  console.log(`   • ORG_ADMIN: ${users.orgAdmins.length}`);
  console.log(`   • TEAM_LEADER: ${users.teamLeaders.length}`);
  console.log(`   • PROFESSIONAL: ${users.professionals.length}`);
  console.log(`   • CUSTOMER: ${users.customers.length}`);
  console.log('\n🏪 Shop Types:');
  console.log(`   • BARBERSHOP: ${shops.filter(s => s.shopType === 'BARBERSHOP').length}`);
  console.log(`   • BEAUTY_SALON: ${shops.filter(s => s.shopType === 'BEAUTY_SALON').length}`);
  console.log(`   • HYBRID: ${shops.filter(s => s.shopType === 'HYBRID').length}`);
  console.log('\n🔐 Test Credentials:');
  console.log(`   • Super Admin: admin@domicitas.do`);
  console.log(`   • Shop Owner (Barber): miguel.barberia@domicitas.do`);
  console.log(`   • Shop Owner (Beauty): ana.belleza@domicitas.do`);
  console.log(`   • Professional: rafael.barbero@domicitas.do`);
  console.log(`   • Customer: juan.cliente@gmail.com`);
  console.log('\n═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
