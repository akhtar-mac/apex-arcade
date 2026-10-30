import { PrismaClient } from '@prisma/client';
import { PICTURE_CARDS } from '../packages/shared-types/src/index.js';

// Credentials come from the environment (see .env.example / docker-compose.yml); none are hardcoded here.
const DATABASE_URL = process.env.DATABASE_URL
  || (process.env.POSTGRES_PASSWORD
    ? `postgresql://${process.env.POSTGRES_USER || 'arcade_user'}:${encodeURIComponent(process.env.POSTGRES_PASSWORD)}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'arcade_db'}?schema=public`
    : '');

if (!DATABASE_URL) {
  console.error('Set DATABASE_URL (or POSTGRES_PASSWORD for the local docker-compose database) before running this script.');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } }
});

async function run() {
  const events = await prisma.gameEvent.findMany();
  console.log(`Found ${events.length} events in DB`);
  for (const event of events) {
    console.log(`Updating ${event.name} (${event.id}) with authentic 14 Pappu picture cards...`);
    await prisma.eventCard.deleteMany({ where: { eventId: event.id } });
    await prisma.gameEvent.update({
      where: { id: event.id },
      data: {
        hostessName: 'Hostess Maya',
        hostessImageUrl: '/hostess.jpg',
        hostessTagline: 'Royal Hostess',
        cards: {
          create: PICTURE_CARDS.map(card => ({
            position: card.id,
            name: card.name,
            hindi: card.hindi,
            symbol: card.symbol,
            imageUrl: card.imageUrl
          }))
        }
      }
    });
  }
  console.log('All events updated successfully to authentic Pappu 14 picture cards!');
  await prisma.$disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
