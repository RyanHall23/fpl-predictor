# USE_FPL_API Environment Variable - Usage Guide

This document explains how to use the `USE_FPL_API` environment variable to control whether the FPL Predictor backend uses real FPL API data or local mock data.

## Overview

The `USE_FPL_API` environment variable allows you to switch between:
- **Real FPL API** (default): Fetches live data from fantasy.premierleague.com
- **Mock Data**: Uses local JSON files that match the exact structure of FPL API responses

This is particularly useful for:
- Testing when the FPL API is unavailable or rate-limited
- Development without internet connectivity
- CI/CD pipelines that need predictable test data
- Faster development iteration without network delays

## Configuration

### Using Real FPL API (Default)

```bash
# No configuration needed - this is the default
cd backend
npm start
```

Or explicitly:
```bash
USE_FPL_API=true npm start
```

### Using Mock Data

```bash
cd backend
USE_FPL_API=false npm start
```

### Using .env File

Create a `.env` file in the `backend` directory:

```env
# For production - use real FPL API
USE_FPL_API=true
JWT_SECRET=your-production-secret

# For testing - use mock data
# USE_FPL_API=false
# JWT_SECRET=test-secret
```

Then start the server normally:
```bash
npm start
```

## Mock Data Structure

Mock data files are located in `backend/mockData/` and include:

- `bootstrap-static.json` - Players, teams, events (gameweeks), game settings
- `fixtures.json` - Match fixtures with teams and dates
- `player-picks.json` - User's team selections for a gameweek
- `entry.json` - User profile and league information
- `history.json` - User's gameweek history and points
- `live-gameweek.json` - Live player statistics for a gameweek
- `element-summary.json` - Individual player history and fixtures

All mock data files match the exact structure returned by the FPL API, ensuring the application works identically with both data sources.

## API Endpoints

All backend API endpoints work with both real and mock data:

### Bootstrap Static Data
```bash
curl http://localhost:5000/api/bootstrap-static
curl http://localhost:5000/api/bootstrap-static/enriched
```

### Predicted Team
```bash
curl http://localhost:5000/api/predicted-team
curl http://localhost:5000/api/predicted-team?gameweek=3
```

### User Team
```bash
curl http://localhost:5000/api/entry/123456/event/2/team
```

### User Profile
```bash
curl http://localhost:5000/api/entry/123456/profile
```

### Transfer Recommendations
```bash
curl http://localhost:5000/api/entry/123456/event/2/recommended-transfers
```

## Testing Examples

### Test Mock Data Loading

```bash
cd backend
USE_FPL_API=false node -e "
const dataProvider = require('./models/dataProvider');
(async () => {
  const bootstrap = await dataProvider.fetchBootstrapStatic();
  console.log('Players:', bootstrap.elements.length);
  console.log('Teams:', bootstrap.teams.length);
  console.log('Events:', bootstrap.events.length);
})();
"
```

### Test Server with Mock Data

```bash
# Terminal 1: Start server with mock data
cd backend
USE_FPL_API=false npm start

# Terminal 2: Test endpoints
curl http://localhost:5000/api/bootstrap-static | jq '.elements | length'
curl http://localhost:5000/api/predicted-team | jq '.mainTeam | length'
```

### Integration Test Script

```javascript
// test-integration.js
const axios = require('axios');

async function testEndpoints() {
  const base = 'http://localhost:5000';
  
  console.log('Testing with mock data...\n');
  
  // Test bootstrap
  const bootstrap = await axios.get(`${base}/api/bootstrap-static`);
  console.log('✓ Bootstrap:', bootstrap.data.elements.length, 'players');
  
  // Test predicted team
  const team = await axios.get(`${base}/api/predicted-team`);
  console.log('✓ Predicted team:', team.data.mainTeam.length, 'starters');
  
  // Test user profile
  const profile = await axios.get(`${base}/api/entry/123456/profile`);
  console.log('✓ User profile:', profile.data.entry.player_first_name);
  
  console.log('\n✅ All tests passed!');
}

testEndpoints().catch(console.error);
```

Run the test:
```bash
# Terminal 1
USE_FPL_API=false npm start

# Terminal 2
node test-integration.js
```

## Customizing Mock Data

To customize mock data for your tests:

1. Edit the JSON files in `backend/mockData/`
2. Ensure the structure matches the FPL API response format
3. Update player IDs, team IDs, and other references consistently across files

Example: Adding a new player to `bootstrap-static.json`:

```json
{
  "id": 6,
  "web_name": "Palmer",
  "first_name": "Cole",
  "second_name": "Palmer",
  "team": 5,
  "element_type": 3,
  "now_cost": 110,
  "ep_next": "7.8",
  "total_points": 0,
  // ... other required fields
}
```

## Troubleshooting

### Mock mode not activating
- Ensure you're setting the environment variable before starting the server
- Check that `USE_FPL_API=false` (lowercase 'false')
- Verify the dataProvider is logging "[Mock Mode]" messages

### Mock data file not found
- Ensure mock data files exist in `backend/mockData/`
- Check file permissions (files should be readable)
- Verify file names match exactly (case-sensitive)

### Data structure mismatch
- Compare mock JSON structure with actual FPL API responses
- Use tools like `jq` to validate JSON structure
- Check the FPL API documentation for field requirements

## Performance Benefits

Using mock data provides several performance advantages during development:

- **Faster startup**: No waiting for external API calls
- **Consistent results**: Same data every time, no variability
- **No rate limiting**: Test as frequently as needed
- **Offline development**: Work without internet connection
- **Predictable tests**: Known data makes test assertions easier

## Production Considerations

⚠️ **Important**: Always use `USE_FPL_API=true` (or default) in production.

Mock data is for development and testing only. Production deployments should:
1. Not set `USE_FPL_API` (defaults to true)
2. Have access to fantasy.premierleague.com
3. Handle API rate limits appropriately
4. Monitor for API availability issues

## Additional Resources

- [FPL API Documentation](https://fantasy.premierleague.com/api/bootstrap-static/)
- [Express.js Environment Variables](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Node.js dotenv Package](https://www.npmjs.com/package/dotenv)
