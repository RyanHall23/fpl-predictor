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
- **Squad History**: Store and view squad snapshots for each gameweek
- **Database Caching**: Reduce API calls by storing team data locally
- **Recommended Transfers Price Display**: Shows purchase price, current market value, and selling price for players being transferred out

### Transfer System
- **Free Transfer Management**: Track free transfers (1 per week, max 2 banked)
- **Points Deduction**: Automatic calculation of -4 points for extra transfers
- **Transfer History**: Complete record of all transfers made
- **Transfer Validation**: Ensures valid position swaps and sufficient funds

### Chip Management
- **All FPL Chips Supported**: Wildcard, Free Hit, Bench Boost, Triple Captain
- **Availability Windows**: Chips available at correct times (GW1-19, GW20-38)
- **Usage Tracking**: Track which chips have been used
- **Chip Rules Enforcement**: 
  - One chip per gameweek
  - Free Hit cannot be used in consecutive gameweeks
  - Saved transfers retained when using Wildcard/Free Hit
  - Wildcard and Free Hit cannot be cancelled once confirmed

### API Features
- **Mock Data Support**: Test without FPL API access using local mock data
- **RESTful API**: Clean, documented API endpoints
- **Authentication**: Secure JWT-based authentication

## Project Structure

```
backend/           # Express.js backend (API, authentication, MongoDB models)
  controllers/     # Backend controllers (business logic)
  models/          # Mongoose models and FPL data logic
  routes/          # Express route definitions
  server.js        # Backend entry point

frontend/          # React frontend (UI)
  public/          # Static assets and index.html
  src/             # Source code for React app
    components/    # React components
    hooks/         # Custom React hooks
    App.js         # Main React app
    index.js       # React entry point

package.json       # Root scripts for running both frontend and backend together
```

## Prerequisites

- Node.js (v14 or higher, recommended v18+)
- npm (v6 or higher, recommended v8+)
- MongoDB (running locally on default port 27017)

## Environment Variables

The backend supports several environment variables to configure behavior:

### Authentication
- `JWT_SECRET` - Secret key for JWT token generation (required in production, defaults to 'changeme' in development)

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
JWT_SECRET=your-secret-key-here
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
    cd backend && npm install
    cd ../frontend && npm install
    cd ..
    ```

### Running the Application

You can start both the backend and frontend together from the root directory:

```sh
npm start
```

- This will run the backend on [http://localhost:5000](http://localhost:5000) and the frontend on [http://localhost:3000](http://localhost:3000).

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

The backend provides comprehensive REST API endpoints for squad management, transfers, and chips.

### Key Endpoints

**Squad Management:**
- `POST /api/squad/initialize` - Initialize user's squad from FPL account
- `GET /api/squad/:userId` - Get current squad with calculated values
- `GET /api/squad/history/:userId/:gameweek` - Get squad for specific gameweek

**Transfers:**
- `POST /api/transfers` - Make a player transfer
- `GET /api/transfers/history/:userId` - Get transfer history
- `GET /api/transfers/summary/:userId/:gameweek` - Get gameweek transfer summary

**Chips:**
- `GET /api/chips/:userId?gameweek=N` - Get available chips for gameweek
- `POST /api/chips/activate` - Activate a chip
- `POST /api/chips/cancel` - Cancel an active chip (if allowed)

**FPL Data:**
- `GET /api/bootstrap-static` - All players, teams, and gameweeks
- `GET /api/predicted-team` - AI-predicted optimal team
- `GET /api/entry/:entryId/event/:eventId/recommended-transfers` - Smart transfer suggestions

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