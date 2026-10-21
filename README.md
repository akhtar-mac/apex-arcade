# Apex Arcade

A 14-picture game with a player app, a landing site, an admin screen, and a desk for checking UPI payments. The API is Express and Socket.IO. Wallets are in Postgres. Redis holds OTP codes and rate limits.

A deposit is a QR code plus a 12-digit UTR that someone on the desk approves. New wallets start at ₹0. There is no payment gateway.

Leave `ENABLE_REGULATED_FEATURES=false` on any public host. Betting and payment routes stay off until that flag is turned on on the server.

## Run locally

You need Node 22, Postgres 16, and Redis 7.

```bash
cp .env.example .env
npm ci
npm run prisma:generate
npx prisma migrate deploy --schema apps/backend/prisma/schema.prisma
npm start
```

- Site: http://localhost:5173
- Player: http://localhost:5174
- Admin: http://localhost:5175
- Desk: http://localhost:5176
- API: http://localhost:4000

`docker compose up -d` starts Postgres and Redis. The Android app is the player UI in a Capacitor shell, not React Native.

```bash
npm --workspace=apps/mobile-app run build
npx cap sync android --cwd apps/mobile-app
cd apps/mobile-app/android && ./gradlew assembleDebug
```

Do not commit a keystore, and do not put a debug APK on the website.

## Checks

```bash
npm test
npm run lint
npm run test:e2e
```
