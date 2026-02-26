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

### Team ID (Local Session)
- **No login required**: Simply enter your FPL Team ID once and it is stored in `localStorage` under the key `fpl-team-id`.
- **Persists across reloads**: Your Team ID is remembered when you refresh the page.
- **Clear at any time**: Click "Clear Team ID" in the navigation bar to remove the stored Team ID.
- You can find your FPL Team ID in the URL of your FPL team page (e.g. `https://fantasy.premierleague.com/entry/<TEAM_ID>/...`).

### Transfer System
- **Recommended Transfers**: Smart transfer suggestions based on predicted points
- **Transfer Validation**: Ensures valid position swaps and sufficient funds

### API Features
- **Mock Data Support**: Test without FPL API access using local mock data
- **RESTful API**: Clean backend proxy for FPL API endpoints
- **SSRF protection** via URL whitelisting
- **Rate limiting** on all API endpoints

## Vercel / Static Hosting Deployment

This application can be deployed as a static frontend with a lightweight backend proxy (no database required).

### Frontend (Static Site)

1. Set the root directory to `frontend`
2. Build command: `npm install && npm run build`
3. Publish directory: `dist`
4. Set the environment variable:
   - `VITE_API_URL` — URL of your deployed backend (e.g. `https://your-backend.onrender.com`)

### Backend (Stateless Proxy)

1. Set the root directory to `backend`
2. Build command: `npm install`
3. Start command: `npm start`
4. Set the environment variable:
   - `FRONTEND_URL` — URL of your deployed frontend (for CORS)
   - `PORT` is automatically provided by most hosting platforms

**No database is required.** The backend only proxies requests to the official FPL API.

### Required Environment Variables Summary

| Service  | Variable       | Description                            |
|----------|---------------|----------------------------------------|
| Backend  | `FRONTEND_URL` | Deployed frontend URL (for CORS)       |
| Frontend | `VITE_API_URL` | Deployed backend URL                   |

```
backend/           # Express.js backend (FPL API proxy only, no DB)
  controllers/     # Backend controllers (business logic)
  models/          # FPL data models
  routes/          # (currently unused, all routes in server.js)
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

## Environment Variables

The backend supports several environment variables to configure behaviour:

### FPL API Configuration
- `USE_FPL_API` - Controls data source for FPL data (default: `'true'`)
  - `'true'` - Use real FPL API (fantasy.premierleague.com)
  - `'false'` - Use local mock data for testing

### Prediction Model Settings
- `USE_COMPUTED_EP` - Toggle between computed vs raw expected points (default: `'true'`)
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

This will use mock data from `backend/mockData/`.

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

The backend provides REST API endpoints as a proxy for the FPL API.

### Key Endpoints

**FPL Data:**
- `GET /api/bootstrap-static` - All players, teams, and gameweeks
- `GET /api/predicted-team` - AI-predicted optimal team
- `GET /api/entry/:entryId/event/:eventId/picks` - Team picks for a gameweek
- `GET /api/entry/:entryId/profile` - FPL entry profile
- `GET /api/entry/:entryId/event/:eventId/recommended-transfers` - Smart transfer suggestions

For complete API documentation, see [backend/API_DOCUMENTATION.md](backend/API_DOCUMENTATION.md)
