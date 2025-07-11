# Earnings Tracker

A web application to track upcoming earnings dates for stocks, built with Next.js, Supabase, and financial APIs.

## Features

- 🔍 Search stocks by symbol or company name
- 📅 View upcoming earnings dates in a calendar format
- 💼 Manage a personal watchlist
- ⚡ Fast performance with multi-layer caching
- 🎨 Dark mode support
- 📱 Responsive design

## Quick Start

1. **Clone the repository and install dependencies:**
```bash
cd earnings-tracker
npm install
```

2. **Set up environment variables:**
```bash
cp .env.local.example .env.local
# Edit .env.local with your actual API keys
```

3. **Set up the database:**
- Create a Supabase project (see ../SUPABASE_SETUP.md)
- Run the schema from `database/schema.sql`

4. **Start the development server:**
```bash
npm run dev
```

Visit http://localhost:3000

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/stocks/search?q={query}` - Search stocks
- `GET /api/earnings/{symbol}` - Get earnings data for a symbol

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase
- **APIs**: Polygon.io (primary), Alpha Vantage (fallback)
- **Deployment**: Vercel

## Architecture

- Multi-layer caching to minimize API calls
- Rate limiting middleware
- Automatic API fallback when limits are reached
- Server-side data fetching with client-side state management

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Deployment

See ../VERCEL_SETUP.md for detailed deployment instructions.

## Configuration

All configuration is done through environment variables. See `.env.local.example` for required variables.

### API Keys Required:
- **Polygon.io**: Get free key at https://polygon.io (5 req/min)
- **Alpha Vantage**: Get free key at https://www.alphavantage.co/support/#api-key (25 req/day)
- **Supabase**: Create project at https://supabase.com

## License

MIT