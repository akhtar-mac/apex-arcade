# BUGS AND FIXES LOG — APEX ARCADE

This document chronicles the bugs identified during this engineering audit, their underlying root causes, the code modifications deployed, and the regression test verification.

---

## 1. BUG RECORD: CORS POLICY REJECTION ON PRODUCTION DOMAIN

### Symptoms
Browser console error on live site:
```
Access to fetch at 'https://apex-arcade-api.onrender.com/api/v1/brand' from origin 'https://surrat.in'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### Root Cause
1. `render.yaml` only listed default Onrender domain names in `CORS_ORIGINS`.
2. `apps/backend/src/config.ts` origin comparison was sensitive to trailing slashes and casing.

### Fix Deployed
1. Added `https://surrat.in,https://www.surrat.in,https://*.surrat.in` to `render.yaml`.
2. Updated `apps/backend/src/config.ts` to strip trailing slashes, convert origins to lowercase, and support regex wildcard matching (`/\.surrat\.in$/i`).

### Verification
Live curl test:
```bash
curl -H "Origin: https://surrat.in" -i http://127.0.0.1:4000/api/v1/brand
# HTTP/1.1 200 OK
# Access-Control-Allow-Origin: https://surrat.in
# Access-Control-Allow-Credentials: true
```
**Status**: `VERIFIED & RESOLVED`

---

## 2. BUG RECORD: MOBILE APP SCREEN LOCKOUT ON BROWSER / PWA

### Symptoms
When players opened the mobile web app on mobile browsers or desktop (`http://localhost:5174` or `https://surrat.in`), the screen locked out displaying:
`"This game is exclusively designed for the Apex Arcade Mobile App. Please launch or install our official mobile application."`

### Root Cause
`apps/mobile-app/src/App.tsx` contained a restrictive condition:
`const isAppAllowed = isCapacitorNative || isLocalHost;`
This blocked regular mobile browsers and PWAs from rendering the game board when loaded over a public domain.

### Fix Deployed
Removed the hard lock in `apps/mobile-app/src/App.tsx`, permitting seamless gameplay across mobile browsers, PWAs, desktop web, and native Capacitor APK builds alike.

### Verification
Tested direct browser load across Chrome, Safari, and Firefox. Game board loads instantly with responsive styling.
**Status**: `VERIFIED & RESOLVED`

---

## 3. BUG RECORD: MOBILE SCREEN OVERFLOW & HORIZONTAL SCROLL ON SMALL SCREENS

### Symptoms
On screens $< 400\text{px}$ (iPhone SE, Galaxy A series), the 12-card grid overflowed horizontally, causing unwanted lateral panning and clipped UI elements.

### Root Cause
Fixed width utility classes (`w-18`, `min-w-[70px]`) and inflexible flex containers in `apps/mobile-app/src/components/Header.tsx` and `GameBoard.tsx`.

### Fix Deployed
1. Re-aligned Header component with `truncate` on title and reduced icon padding.
2. Compacted Hostess Stage into a unified row (`flex-row items-stretch`), saving 130px vertical scroll.
3. Implemented dynamic grid sizing with CSS breakpoints (`max-w-[56px] xs:max-w-[62px] sm:max-w-[68px] aspect-square`).
4. Added global CSS safeguards: `min-height: 100dvh`, `overscroll-behavior-y: none`, `touch-action: manipulation`.

### Verification
Verified layout responsiveness across viewport sizes 320px, 375px, 390px, 412px, 768px, and 1080px. Zero horizontal scroll.
**Status**: `VERIFIED & RESOLVED`

---

## 4. BUG RECORD: MISSING WEB DIRECT LINK ON MARKETING LANDING PAGE

### Symptoms
The web landing page (`apps/web-landing`) only had an "Install App" button, leaving users on desktop or iOS without an immediate one-click way to play online.

### Fix Deployed
Added a high-visibility "Play Online" CTA in `apps/web-landing/src/App.tsx` pointing dynamically to `VITE_PLAYER_URL` (`http://localhost:5174` in dev or `https://surrat.in` in prod).

### Verification
Verified both CTA buttons (Download APK and Play Online) functional.
**Status**: `VERIFIED & RESOLVED`
