# Fantasy Premier League Points Predictor

This project aims to predict Fantasy Premier League points for players using various data analysis and machine learning techniques.

## Project Guidance

This project is guided by GitHub Copilot, an AI-powered coding assistant that helps developers write code faster and with fewer errors.

## Purpose

The main goal of this project is to create a model that can accurately predict the points that players will score in the Fantasy Premier League. This can help fantasy football managers make better decisions when selecting their teams.

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