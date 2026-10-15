FROM node:22-alpine

WORKDIR /app

# Install openssl for Prisma on Alpine Linux
RUN apk add --no-cache openssl

COPY package*.json ./
COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/

# Install all dependencies including workspaces
RUN npm install

# Build shared packages and backend
WORKDIR /app
RUN npm --workspace=packages/shared-types run build
WORKDIR /app/apps/backend
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]

