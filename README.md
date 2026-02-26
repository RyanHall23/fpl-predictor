# Fantasy Premier League Points Predictor

This project aims to predict Fantasy Premier League points for players using various data analysis and machine learning techniques.

## Project Guidance

This project is guided by GitHub Copilot, an AI-powered coding assistant that helps developers write code faster and with fewer errors.

## Purpose

The main goal of this project is to create a model that can accurately predict the points that players will score in the Fantasy Premier League. This can help fantasy football managers make better decisions when selecting their teams.

## Features

### Prediction Engine
- **ML-based Point Predictions**: Uses expected goals (xG), expected assists (xA), clean sheets, and head-to-head data
- **Opponent Analysis**: Enriches players with opponent difficulty and fixture information
- **Gameweek Forecasting**: Predict player performance for future gameweeks

### Squad Management
- **Player Value Tracking**: Track purchase prices vs current prices for all players
- **Selling Price Calculation**: Automatically calculates selling price with profit rules (keep 50% of profit, rounded down)
- **Recommended Transfers Price Display**: Shows purchase price, current market value, and selling price for players being transferred out

### Transfer System
- **Free Transfer Management**: Track free transfers (1 per week, max 2 banked)
- **Points Deduction**: Automatic calculation of -4 points for extra transfers
- **Transfer Validation**: Ensures valid position swaps and sufficient funds
- **localStorage Persistence**: Planned transfers stored locally per team ID (`fpl_transfers_{teamId}`)

### Chip Management
- **All FPL Chips Supported**: Wildcard, Free Hit, Bench Boost, Triple Captain
- **Availability Windows**: Chips available at correct times (GW1-19, GW20-38)
- **Usage Tracking**: Track which chips have been used

### Team ID Flow
- On first load, a dialog prompts you to enter your FPL Team ID (a numeric ID found on the FPL website)
- The Team ID is persisted in `localStorage` under the key `fpl_team_id`
- Use the **"Change Team ID"** button in the navigation bar to update or clear your Team ID
- No account or password required

### API Features
- **Mock Data Support**: Test without FPL API access using local mock data
- **RESTful API**: Clean, documented API endpoints
- **SSRF protection** via URL whitelisting
- **4-tier rate limiting** (general API, read operations)

## Vercel Deployment

This application is deployed as a static frontend with Express serverless backend on [Vercel](https://vercel.com).

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/RyanHall23/fpl-predictor)

### Manual Deployment (Vercel CLI)

1. Install the Vercel CLI:
   ```sh
   npm install -g vercel
   ```

2. Deploy from the repo root:
   ```sh
   vercel
   ```

3. Set the following environment variable in the Vercel dashboard under your project settings:
   - `FRONTEND_URL` — Your Vercel deployment URL (e.g. `https://fpl-predictor-cyan.vercel.app`)

### How It Works on Vercel

- The **frontend** (`frontend/dist`) is served as a static site.
- All `/api/*` requests are handled by the Express app exported from `api/index.js` as a Vercel Serverless Function.
- Local development uses Vite's proxy (`/api` → `http://localhost:5000`) — no change needed for local dev.

### Required Environment Variables

| Service  | Variable        | Description                                  |
|----------|----------------|----------------------------------------------|
| Backend  | `FRONTEND_URL`  | Deployed frontend URL (for CORS)             |
| Backend  | `USE_FPL_API`   | `true` to use live FPL API, `false` for mock |
| Backend  | `USE_COMPUTED_EP` | `true` for ML predictions, `false` for raw |
| Backend  | `INCLUDE_MANAGERS` | `false` (default) — exclude manager placeholders |

```
backend/           # Express.js backend (API, FPL data proxy)
  controllers/     # Backend controllers (business logic)
  models/          # FPL data logic
  routes/          # Express route definitions (squad, chips, transfers)
  server.js        # Backend entry point (also exported for Vercel)

api/
  index.js         # Vercel Serverless Function entry point

frontend/          # React frontend (UI)
  public/          # Static assets and index.html
  src/             # Source code for React app
    components/    # React components
    hooks/         # Custom React hooks
    App.js         # Main React app
    index.jsx      # React entry point

vercel.json        # Vercel deployment configuration
package.json       # Root scripts for running both frontend and backend together
```

## Prerequisites

- Node.js (v18 or higher recommended)
- npm (v8 or higher recommended)

## Environment Variables

The backend supports several environment variables to configure behaviour:

### FPL API Configuration
- `USE_FPL_API` - Controls data source for FPL data (default: `'true'`)
  - `'true'` - Use real FPL API (fantasy.premierleague.com)
  - `'false'` - Use local mock data for testing (useful when API is unavailable or for development)

### Prediction Model Settings
- `USE_COMPUTED_EP` - Toggle between computed vs raw expected points (default: `'true'`)
  - `'true'` - Use computed expected points from ML model
  - `'false'` - Use raw API expected points
- `INCLUDE_MANAGERS` - Include manager placeholders in squads (default: `'false'`)

### Setting Environment Variables

Create a `.env` file in the `backend` directory:

```sh
# Example .env file
USE_FPL_API=true
USE_COMPUTED_EP=true
INCLUDE_MANAGERS=false
```

For testing without FPL API access:
```sh
USE_FPL_API=false
```

This will use mock data from `backend/mockData/` that matches the exact structure of FPL API responses.

### Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/ryanhall23/fpl-predictor.git
    cd fpl-predictor
    ```

2. Install dependencies for all parts (root, frontend, backend):
    ```sh
    npm install
    ```

### Running the Application

You can start both the backend and frontend together from the root directory:

```sh
npm start
```

- This will run the backend on [http://localhost:5000](http://localhost:5000) and the frontend on [http://localhost:5173](http://localhost:5173).

**Alternatively, to run them separately:**

- Start the backend:
    ```sh
    cd backend
    npm start
    ```
- In a new terminal, start the frontend:
    ```sh
    cd frontend
    npm start
    ```

## API Documentation

The backend provides REST API endpoints for squad management, transfers, chips, and FPL data.

### Key Endpoints

**FPL Data:**
- `GET /api/bootstrap-static` - All players, teams, and gameweeks
- `GET /api/predicted-team` - AI-predicted optimal team
- `GET /api/entry/:entryId/event/:eventId/recommended-transfers` - Smart transfer suggestions
- `GET /api/entry/:entryId/profile` - FPL manager profile and league standings

**Transfers & Validation:**
- `POST /api/validate-swap` - Validate a player swap
- `POST /api/available-transfers/:playerCode` - Get available transfer targets

For complete API documentation, see [backend/API_DOCUMENTATION.md](backend/API_DOCUMENTATION.md)

## Player Value System

The application implements FPL's player pricing rules:

- **Purchase Price**: Price when player was added to squad
- **Current Price**: Live market price from FPL API
- **Selling Price**: `Purchase Price + floor((Current Price - Purchase Price) / 2)`

**Example:**
- Bought player at £7.5m
- Current price rises to £7.8m
- Profit = £0.3m
- Selling price = £7.5m + floor(£0.3m / 2) = £7.5m + £0.1m = **£7.6m**

## Transfer Rules

- **1 Free Transfer per gameweek** (unused transfers carry over, max 2)
- **-4 Points** for each additional transfer beyond free transfers
- **Wildcard**: All transfers free for the gameweek
- **Free Hit**: Unlimited free transfers, squad reverts next gameweek

## Chip System

| Chip | Effect | Availability |
|------|--------|--------------|
| **Bench Boost** | Bench players' points count | 2 chips: GW1-19, GW20-38 |
| **Triple Captain** | Captain points tripled (3x) | 2 chips: GW1-19, GW20-38 |
| **Free Hit** | Unlimited free transfers, reverts next GW | 2 chips: GW2-19, GW20-38 |
| **Wildcard** | All transfers free for the gameweek | 2 chips: GW2-19, GW20-38 |

**Rules:**
- Only one chip per gameweek
- Free Hit cannot be used in consecutive gameweeks
- Wildcard and Free Hit cannot be cancelled once confirmed
- Bench Boost and Triple Captain can be cancelled before deadline
- Saved free transfers are retained when using Wildcard or Free Hit