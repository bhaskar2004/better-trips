
# BetterTrips

A Next.js app that helps you discover nearby tourist places in India. It geocodes a user-provided location and returns prioritized points of interest using the Geoapify APIs.

## Features

- **Location search** with smart normalization and variations for Indian places
- **Tourist places API** with category-aware scoring and famous-place boosting
- **Caching** for faster repeated queries (in-memory, short TTL)
- **TypeScript**, **App Router**, modern UI components

## Tech Stack

- Next.js 15
- TypeScript
- Geoapify Geocoding and Places APIs

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Geoapify API key: https://www.geoapify.com/

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the project root and add:

```bash
GEOAPIFY_API_KEY=your_api_key_here
```

### Development

```bash
npm run dev
# App: http://localhost:3000
```

### Build

```bash
npm run build
```

### Start (Production)

```bash
npm start
# App: http://localhost:3000
```

## API

All routes are under `app/api/*`.

- `POST /api/tourist-places`
  - Body: `{ "placeName": "<location>" }`
  - Returns: `{ success, location: { lat, lon, name }, places: [...] }`
  - Notes: Accepts many common aliases and variations for Indian cities/regions.

- `GET /api/tourist-places?place=<location>`
  - Same as POST, convenient for quick testing.

- `GET /api/autocomplete`
  - Lightweight endpoint for place suggestions (implementation in `app/api/autocomplete/route.ts`).

- `GET /api/nearby`
  - Nearby POIs given a location (implementation in `app/api/nearby/route.ts`).

### Prioritization

- Famous places per-location receive higher priority.
- Category boosts (e.g., `tourism.attraction`, `tourism.sights`, `natural`, `heritage`).

### Caching

- In-memory Map with a short TTL (currently 120 seconds) to reduce API calls.

## Deployment

- Ensure `GEOAPIFY_API_KEY` is set in your hosting provider’s environment.
- Run `npm run build` during CI, then `npm start` in a Node runtime.

## Troubleshooting

- Duplicate-key issues in large mapping objects are avoided by constructing mappings via multiple `Object.assign` calls.
- If Geoapify returns no features, try a more specific place or include state (e.g., "Kumbakonam, Tamil Nadu").


