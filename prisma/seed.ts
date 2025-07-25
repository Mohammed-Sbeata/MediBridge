import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const specialties = [
  'Cardiology',
  'Dermatology',
  'Emergency Medicine',
  'Family Medicine',
  'Internal Medicine',
  'Neurology',
  'Obstetrics and Gynecology',
  'Oncology',
  'Pediatrics',
  'Psychiatry',
  'Surgery',
  'Other',
];

async function main() {
  console.log('Starting to seed specialties...');

  for (const specialtyName of specialties) {
    await prisma.specialty.upsert({
      where: { name: specialtyName },
      update: {},
      create: { name: specialtyName },
    });
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error('Error seeding the database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 