# DEVOPS & INFRASTRUCTURE AUDIT — APEX ARCADE

**Containerization**: Docker / Docker Compose  
**Reverse Proxy**: Nginx Alpine  
**Database Connection Pooling**: PgBouncer Alpine (Transaction Pooling)  
**Cloud Deployment Target**: Render PaaS / AWS ECS / Self-Hosted VPS  

---

## 1. DOCKER & CONTAINER ARCHITECTURE

The deployment topology runs four isolated containerized services defined in `docker-compose.yml`:

```yaml
services:
  arcade_postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: arcade_db
      POSTGRES_USER: arcade_user
      POSTGRES_PASSWORD: <SECRET>
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U arcade_user -d arcade_db"]

  arcade_pgbouncer:
    image: edoburu/pgbouncer:v1.22.1
    restart: always
    environment:
      DB_USER: arcade_user
      DB_PASSWORD: <SECRET>
      DB_HOST: arcade_postgres
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 1000
      DEFAULT_POOL_SIZE: 25

  arcade_redis:
    image: redis:7-alpine
    restart: always
    command: ["redis-server", "--appendonly", "yes", "--requirepass", "<SECRET>"]
    volumes:
      - redisdata:/data

  arcade_nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
```

---

## 2. PRODUCTION MULTI-STAGE DOCKERFILE

The backend utilizes a hardened multi-stage Docker build (`apps/backend/Dockerfile`):
- **Stage 1 (Builder)**: Installs npm dependencies, generates Prisma client (`npx prisma generate`), and compiles TypeScript source code (`npm run build`).
- **Stage 2 (Runner)**:
  - Uses minimal Node 22 Alpine base image.
  - Copies only compiled JavaScript (`dist/`), Prisma generated artifacts, and production dependencies.
  - Runs under non-root unprivileged user (`node`).
  - No development dependencies, source maps, or build tooling in final container image.

---

## 3. CLOUD DEPLOYMENT SPECIFICATION (`render.yaml`)

The repository includes a production-ready `render.yaml` specification for Render PaaS:
- **Web Service (`apex-arcade-api`)**:
  - Environment: `node`
  - Build Command: `npm install && npm run build:backend`
  - Start Command: `npm run start:backend`
  - Automatic SSL certificates via Let's Encrypt.
  - Strict CORS origin whitelisting:
    `https://surrat.in,https://www.surrat.in,https://*.surrat.in`
- **Managed Database (`apex-arcade-db`)**:
  - PostgreSQL 16 with automatic daily backups.
- **Managed Redis (`apex-arcade-redis`)**:
  - In-memory key-value store with TLS encryption.

---

## 4. ANDROID APK BUILD PIPELINE

- **Location**: `apps/mobile-app/android/`
- **Output Artifact**: `apex-arcade-1.1.apk` (15.6 MB)
- **Signing**: Signed with production release keystore (`android.keystore`, SHA-256 fingerprint verified).
- **ProGuard / R8**: Code obfuscation and resource shrinking enabled in `app/build.gradle`.
- **Cleartext Traffic**: Hardened to `android:usesCleartextTraffic="false"`.
- **Distribution**: Staged directly on marketing website (`apps/web-landing/public/downloads/apex-arcade-1.1.apk`), avoiding third-party store app review delays.

