import { getPrisma } from '../db.js';

const DEFAULT_BRAND = {
  id: 'brand',
  appName: 'Apex Arcade',
  shortName: 'APEX',
  tagline: 'Pick a card. Win 10×.',
  logoUrl: ''
};

function clean(value: unknown, max: number) {
  return String(value || '').trim().slice(0, max);
}

export class BrandService {
  static async get() {
    const prisma = getPrisma();
    const row = await prisma.brandSetting.findUnique({ where: { id: 'brand' } });
    if (!row) return { ...DEFAULT_BRAND };
    return {
      appName: row.appName,
      shortName: row.shortName,
      tagline: row.tagline,
      logoUrl: row.logoUrl
    };
  }

  static async update(input: { appName?: string; shortName?: string; tagline?: string; logoUrl?: string }) {
    const appName = clean(input.appName, 40);
    const shortName = clean(input.shortName, 12);
    const tagline = clean(input.tagline, 80);
    const logoUrl = clean(input.logoUrl, 400000);
    if (appName.length < 2) throw new Error('Website name must be at least 2 characters.');
    if (shortName.length < 2) throw new Error('Short name must be at least 2 characters.');
    if (logoUrl && !logoUrl.startsWith('data:image/') && !logoUrl.startsWith('/') && !logoUrl.startsWith('https://')) {
      throw new Error('The logo must be an uploaded image or an https link.');
    }
    const prisma = getPrisma();
    const saved = await prisma.brandSetting.upsert({
      where: { id: 'brand' },
      create: { id: 'brand', appName, shortName, tagline, logoUrl },
      update: { appName, shortName, tagline, logoUrl }
    });
    return {
      appName: saved.appName,
      shortName: saved.shortName,
      tagline: saved.tagline,
      logoUrl: saved.logoUrl
    };
  }
}
