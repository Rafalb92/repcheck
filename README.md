# RepCheck

Analiza techniki podnoszenia ciężarów w przeglądarce. Wgrywasz wideo serii (przysiad, martwy ciąg, wyciskanie), aplikacja wykrywa pozycję ciała oraz tor sztangi, segmentuje powtórzenia i liczy metryki: średnią prędkość koncentryczną, velocity loss, kąty stawów, odchylenie toru sztangi od pionu, asymetrię lewo-prawo.

Cała analiza wideo dzieje się lokalnie w przeglądarce — bez wysyłania klatek na serwer.

> **Status:** Work in progress. Projekt portfolio.

## Stack

**Frontend** — Next.js 15 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, Zustand
**Backend** — NestJS 10, TypeORM, PostgreSQL
**ML / CV (w przeglądarce)** — TensorFlow.js (MoveNet), OpenCV.js
**Wideo** — FFmpeg.wasm
**Storage** — S3-compatible (MinIO lokalnie, R2 / S3 w produkcji)
**Monorepo** — Turborepo + pnpm

## Struktura

```
repcheck/
├── apps/
│   ├── web/          # Next.js — UI i analiza wideo
│   └── api/          # NestJS — sesje treningowe, auth, storage
└── packages/
    ├── shared/       # Współdzielone typy TypeScript
    └── tsconfig/     # Bazowe konfiguracje TS
```

## Uruchomienie lokalne

Wymagania: Node 20+, pnpm 9+, Docker.

```bash
# 1. Instalacja zależności
pnpm install

# 2. Postgres + MinIO w tle
docker compose up -d

# 3. Pliki .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 4. Start web (:3000) + api (:3001)
pnpm dev
```

Sprawdzenie że API działa:

```bash
curl http://localhost:3001/api/health
```

## Plan projektu

- [x] Tydzień 1 — Setup monorepo, health endpoint, docker compose
- [ ] Tydzień 2 — Upload wideo, odtwarzacz, pose estimation (TensorFlow.js + MoveNet)
- [ ] Tydzień 3 — Bar tracking (OpenCV.js, template matching)
- [ ] Tydzień 4 — Smoothing (Savitzky-Golay, Kalman), segmentacja powtórzeń
- [ ] Tydzień 5 — Metryki: prędkość, kąty, tor sztangi, kalibracja
- [ ] Tydzień 6 — Wizualizacje (Recharts), wykresy per rep i per sesja
- [ ] Tydzień 7 — Auth (JWT), encje TypeORM, endpointy sesji
- [ ] Tydzień 8 — Storage wideo (S3), historia sesji, progress over time
- [ ] Tydzień 9 — Side-by-side compare (DTW), rule-based form check
- [ ] Tydzień 10 — PWA, export PDF, deployment, README z demo

## Licencja

MIT
