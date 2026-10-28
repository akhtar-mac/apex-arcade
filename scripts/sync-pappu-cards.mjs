import { PrismaClient } from '@prisma/client';
import { PICTURE_CARDS } from '../packages/shared-types/src/index.js';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL || 'postgresql://arcade_user:arcade_secure_password_2026@localhost:5432/arcade_db?schema=public' } }
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
