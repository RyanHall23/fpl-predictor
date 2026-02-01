# Squad Management, Transfers, and Chips - Implementation Summary

## Overview

This document summarizes the implementation of the FPL squad management system, including player value tracking, transfer management, and chip system.

## Problem Statement

Implement a comprehensive system to:
1. **Track player values** with FPL's pricing rules (keep 50% of profit when selling)
2. **Store squad data** in database to reduce API calls
3. **Manage transfers** with free transfer bank and points deductions
4. **Implement chip system** with all FPL chips and their rules

## Implementation

### Database Models

#### 1. Squad Model (`squadModel.js`)
Stores a user's current FPL squad.

**Key Fields:**
- `userId`: Reference to User
- `gameweek`: Current gameweek
- `players[]`: Array of players with purchase/current prices
- `bank`: Money in bank (£0.1m units)
- `squadValue`: Total squad value
- `freeTransfers`: Available free transfers (0-2)
- `transfersMadeThisWeek`: Transfer count this gameweek
- `pointsDeducted`: Points lost from transfers
- `activeChip`: Currently active chip

**Key Methods:**
- `getSellingPrice()`: Calculate selling price with profit rules
- `getTotalSellingValue()`: Calculate total squad selling value
- `getTransferCost()`: Calculate points cost for transfers

#### 2. SquadHistory Model (`squadHistoryModel.js`)
Stores historical snapshots of squads for each gameweek.

**Key Fields:**
- `userId`: Reference to User
- `gameweek`: Gameweek number
- `players[]`: Squad snapshot
- `pointsScored`: Points scored that gameweek
- `overallRank`: User's rank

#### 3. Transfer Model (`transferModel.js`)
Records all player transfers.

**Key Fields:**
- `userId`: Reference to User
- `gameweek`: Gameweek when transfer was made
- `playerIn`: Player bought (ID and price)
- `playerOut`: Player sold (ID, purchase price, selling price)
- `isFree`: Whether transfer was free
- `pointsCost`: Points deducted (0 or 4)
- `chipActive`: Active chip during transfer

#### 4. Chip Model (`chipModel.js`)
Tracks chip availability and usage for each user.

**Chips Tracked:**
- Bench Boost 1 & 2
- Triple Captain 1 & 2
- Free Hit 1 & 2
- Wildcard 1 & 2

**Key Methods:**
- `getAvailableChips(gameweek)`: Get available chips for a gameweek
- `useChip(chipName, gameweek)`: Mark a chip as used

### Controllers

#### 1. Squad Controller (`squadController.js`)

**Functions:**
- `initializeSquad()`: Initialize user's squad from FPL API
- `getSquad()`: Get current squad with calculated values
- `getSquadHistory()`: Get squad for specific gameweek
- `getAllSquadHistory()`: Get all squad history
- `updateForNewGameweek()`: Update squad for new gameweek

#### 2. Transfer Controller (`transferController.js`)

**Functions:**
- `makeTransfer()`: Execute a player transfer
- `getTransferHistory()`: Get transfer history
- `getTransferSummary()`: Get gameweek transfer summary

**Transfer Validation:**
- Players must be same position type
- Sufficient funds must be available
- Selling price calculated with profit rules
- Transfer cost calculated based on free transfers and chips

#### 3. Chip Controller (`chipController.js`)

**Functions:**
- `getAvailableChips()`: Get chips available for gameweek
- `activateChip()`: Activate a chip
- `cancelChip()`: Cancel active chip (if allowed)

**Chip Rules Enforced:**
- Only one chip per gameweek
- Free Hit cannot be used in consecutive gameweeks
- Chips must be within availability windows
- Wildcard and Free Hit cannot be cancelled once confirmed

### API Endpoints

#### Squad Management
```
POST   /api/squad/initialize
GET    /api/squad/:userId
GET    /api/squad/history/:userId/:gameweek
GET    /api/squad/history/:userId
POST   /api/squad/update-gameweek
```

#### Transfers
```
POST   /api/transfers
GET    /api/transfers/history/:userId
GET    /api/transfers/summary/:userId/:gameweek
```

#### Chips
```
GET    /api/chips/:userId?gameweek=N
POST   /api/chips/activate
POST   /api/chips/cancel
```

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

## Player Value System

### Calculation Rules

**Purchase Price**: Price when player was added to squad (£0.1m units)

**Current Price**: Live market price from FPL API

**Selling Price**: 
```javascript
if (currentPrice <= purchasePrice) {
  sellingPrice = currentPrice;
} else {
  profit = currentPrice - purchasePrice;
  profitToKeep = Math.floor(profit / 2);
  sellingPrice = purchasePrice + profitToKeep;
}
```

### Examples

| Purchase | Current | Profit | Kept | Selling |
|----------|---------|--------|------|---------|
| £7.5m    | £7.8m   | £0.3m  | £0.1m| £7.6m   |
| £10.0m   | £10.5m  | £0.5m  | £0.2m| £10.2m  |
| £8.0m    | £7.5m   | -£0.5m | £0   | £7.5m   |

## Transfer System

### Free Transfers

- **1 free transfer** per gameweek
- Unused transfers **carry over** to next week
- **Maximum 2** free transfers can be banked
- Reset to 1 if any transfers made

### Transfer Costs

- **Free**: If within free transfer allowance
- **Free**: If Wildcard or Free Hit active
- **-4 points**: For each extra transfer

### Example Scenarios

**Scenario 1: Banking Transfers**
- GW1: No transfers → 2 free transfers in GW2
- GW2: 1 transfer → 1 free transfer in GW3
- GW3: 0 transfers → 2 free transfers in GW4

**Scenario 2: Extra Transfers**
- GW5: 1 free transfer available
- Make 3 transfers
- Cost: 2 × 4 = **-8 points**

**Scenario 3: Wildcard**
- Activate Wildcard in GW10
- Make 10 transfers
- Cost: **0 points** (all free)

## Chip System

### Chip Types

#### 1. Bench Boost
- **Effect**: Bench players' points count
- **Availability**: 2 chips (GW1-19, GW20-38)
- **Cancellable**: Yes (before deadline)

#### 2. Triple Captain
- **Effect**: Captain points tripled (3×)
- **Availability**: 2 chips (GW1-19, GW20-38)
- **Cancellable**: Yes (before deadline)

#### 3. Free Hit
- **Effect**: Unlimited free transfers, squad reverts next GW
- **Availability**: 2 chips (GW2-19, GW20-38)
- **Cancellable**: No (once confirmed)
- **Special Rule**: Cannot use in consecutive gameweeks

#### 4. Wildcard
- **Effect**: All transfers free for the gameweek
- **Availability**: 2 chips (GW2-19, GW20-38)
- **Cancellable**: No (once confirmed)

### Chip Rules

1. **One chip per gameweek** maximum
2. **Free Hit consecutive rule**: Must skip at least one GW between uses
3. **Saved transfers retained**: When using Wildcard or Free Hit
4. **Cancellation rules**: 
   - Bench Boost and Triple Captain can be cancelled
   - Wildcard and Free Hit cannot be cancelled once confirmed

## Testing

### Test Coverage

#### 1. Player Value Calculations
```
✓ Price increase: £7.5m → £7.8m = £7.6m
✓ Price decrease: £8m → £7.5m = £7.5m
✓ No change: £10m → £10m = £10m
✓ Large increase: £5m → £6.5m = £5.7m
```

#### 2. Transfer Cost Calculations
```
✓ 1 transfer, 1 free: 0 points
✓ 2 transfers, 1 free: 4 points
✓ 3 transfers, 2 free: 4 points
✓ 5 transfers, wildcard: 0 points
✓ 10 transfers, free hit: 0 points
```

#### 3. Chip Availability Logic
```
✓ BB1 in GW1: available
✓ BB1 in GW20: not available (out of range)
✓ FH1 in GW1: not available (starts GW2)
✓ FH1 in GW5 after GW4: not available (consecutive)
✓ FH1 in GW6 after GW4: available
✓ WC2 in GW25: available
```

#### 4. Model Structures
```
✓ Squad model structure
✓ Transfer model structure
✓ Chip model structure
✓ Chip availability methods
✓ Chip usage methods
```

### Running Tests

```bash
cd backend
./test-integration.sh
```

All tests pass without requiring MongoDB connection.

## Data Flow

### Initializing Squad

```
User Request → Initialize Squad
                     ↓
              Fetch from FPL API
                     ↓
              Create Squad Document
                     ↓
              Create Chip Document
                     ↓
              Create History Snapshot
                     ↓
              Return Squad Data
```

### Making Transfer

```
User Request → Make Transfer
                     ↓
              Validate Squad Exists
                     ↓
              Validate Same Position
                     ↓
              Calculate Selling Price
                     ↓
              Check Funds Available
                     ↓
              Calculate Transfer Cost
                     ↓
              Update Squad
                     ↓
              Record Transfer
                     ↓
              Return Updated Squad
```

### Activating Chip

```
User Request → Activate Chip
                     ↓
              Validate Chip Available
                     ↓
              Check No Active Chip
                     ↓
              Validate Gameweek Range
                     ↓
              Check Consecutive Rule (Free Hit)
                     ↓
              Save Pre-Chip State (Free Hit)
                     ↓
              Mark Chip as Used
                     ↓
              Update Squad with Active Chip
                     ↓
              Apply Chip Effects
                     ↓
              Return Success
```

## Database Collections

### squads
- Stores one current squad per user
- Updated on transfers and gameweek changes

### squadhistories
- Stores one snapshot per user per gameweek
- Created at gameweek start and when chips are used
- Immutable once created

### transfers
- Records every transfer made
- Used for history and analytics

### chips
- Stores one document per user
- Tracks all chip availability and usage

## Files Created

### Models (4 files)
- `backend/models/squadModel.js` (2,995 bytes)
- `backend/models/squadHistoryModel.js` (1,335 bytes)
- `backend/models/transferModel.js` (1,287 bytes)
- `backend/models/chipModel.js` (5,292 bytes)

### Controllers (3 files)
- `backend/controllers/squadController.js` (7,897 bytes)
- `backend/controllers/transferController.js` (7,653 bytes)
- `backend/controllers/chipController.js` (8,852 bytes)

### Routes (3 files)
- `backend/routes/squad.js` (791 bytes)
- `backend/routes/transfers.js` (568 bytes)
- `backend/routes/chips.js` (516 bytes)

### Documentation (2 files)
- `backend/API_DOCUMENTATION.md` (11,785 bytes)
- `backend/test-integration.sh` (7,518 bytes)

### Modified Files (2 files)
- `backend/server.js` (added route imports)
- `README.md` (added features section)

## Usage Examples

### Example 1: Initialize Squad and Make Transfer

```javascript
// 1. Initialize squad from FPL account
const initResponse = await fetch('/api/squad/initialize', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 'user_id_here',
    entryId: 123456,  // FPL team ID
    gameweek: 1
  })
});

// 2. Get current squad
const squadResponse = await fetch('/api/squad/user_id_here', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const squad = await squadResponse.json();

// 3. Make a transfer
const transferResponse = await fetch('/api/transfers', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 'user_id_here',
    playerOutId: 123,  // Player to sell
    playerInId: 456,   // Player to buy
    gameweek: 1
  })
});
```

### Example 2: Use Wildcard and Make Multiple Transfers

```javascript
// 1. Activate Wildcard
await fetch('/api/chips/activate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 'user_id_here',
    chipName: 'wildcard_1',
    gameweek: 5
  })
});

// 2. Make multiple transfers (all free due to wildcard)
for (let i = 0; i < 10; i++) {
  await fetch('/api/transfers', {
    method: 'POST',
    body: JSON.stringify({
      userId: 'user_id_here',
      playerOutId: oldPlayers[i],
      playerInId: newPlayers[i],
      gameweek: 5
    })
  });
}
// Total cost: 0 points
```

### Example 3: Check Available Chips

```javascript
const chipsResponse = await fetch('/api/chips/user_id_here?gameweek=10', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { availableChips } = await chipsResponse.json();

// availableChips will be an array like:
// [
//   { id: 'bench_boost_1', type: 'bench_boost', description: '...' },
//   { id: 'triple_captain_1', type: 'triple_captain', description: '...' },
//   ...
// ]
```

## Production Deployment

### Prerequisites

1. **MongoDB**: Running on localhost:27017 or configure connection string
2. **Node.js**: v14+ installed
3. **Environment Variables**: Set in `.env` file

### Environment Setup

```bash
# .env file
JWT_SECRET=your-production-secret-key
USE_FPL_API=true
USE_COMPUTED_EP=true
INCLUDE_MANAGERS=false
```

### Starting the Application

```bash
# Install dependencies
cd backend && npm install

# Start MongoDB
mongod --dbpath /path/to/data

# Start backend
npm start
```

### Initial User Setup

1. User registers/logs in
2. User initializes squad with their FPL team ID
3. System fetches current squad from FPL API
4. Squad stored in database with purchase prices
5. User can now make transfers and use chips

## Performance Considerations

### Database Queries

- Squad queries use userId index (unique)
- Transfer queries use compound index (userId, gameweek)
- History queries use compound unique index (userId, gameweek)

### API Call Reduction

- Squad data cached in database
- Only fetch from FPL API when:
  - Initializing squad
  - Getting current player prices
  - Making transfers (to get new player data)

### Caching Strategy

1. **Squad data**: Stored in database, updated on transfers
2. **History snapshots**: Immutable, stored per gameweek
3. **Player prices**: Fetched from FPL API on demand

## Future Enhancements

Potential improvements for future versions:

1. **Price Change Notifications**: Alert users when their players' prices change
2. **Transfer Suggestions**: AI-powered transfer recommendations
3. **Chip Strategy**: Suggest optimal times to use chips
4. **League Integration**: Compare squad with league competitors
5. **Auto-Save**: Periodic squad snapshots during gameweek
6. **Transfer Planner**: Multi-gameweek transfer planning tool
7. **Performance Tracking**: Analyze past transfer decisions
8. **Value Analysis**: Track squad value changes over time

## Support

For detailed API documentation, see [backend/API_DOCUMENTATION.md](API_DOCUMENTATION.md)

For mock data usage, see [backend/MOCK_DATA_GUIDE.md](MOCK_DATA_GUIDE.md)

---

**Implementation Complete**: All features tested and working ✅
