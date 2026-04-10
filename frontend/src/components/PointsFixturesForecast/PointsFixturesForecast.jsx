import React from 'react';
import PropTypes from 'prop-types';
import { Box, Chip, Typography } from '@mui/material';
import FixturePill from '../FixturePill/FixturePill';

/**
 * Displays predicted points and fixtures for one or more gameweeks in a
 * compact column-per-gameweek layout.
 *
 * Each gameweek column renders:
 *   - Predicted points as the bold "title"
 *   - FDR fixture pill(s) as a row beneath
 *
 * @param {Array}   gwData        - Array of { gw, points, opponents }
 * @param {string}  [pointsColor] - MUI colour token for the points text, e.g. 'error' | 'success.main'
 * @param {number}  [diff]        - Cumulative points diff shown as a trailing chip
 */
const PointsFixturesForecast = ({ gwData, pointsColor = 'text.primary', diff }) => {
  if (!gwData || gwData.length === 0) return null;

  const showDiff = diff != null && diff !== 0;
  const diffLabel = diff > 0 ? `+${Math.round(diff)}` : `${Math.round(diff)}`;
  const diffColor = diff > 0 ? 'success' : 'error';

  return (
    <Box sx={ { display: 'flex', gap: 1, alignItems: 'center' } }>
      { gwData.map(({ gw, points, opponents }) => {
        const fixtures = opponents && opponents.length > 0
          ? opponents.map((o) => ({
              label: `${o.opponent_short || '-'}${o.is_home != null ? (o.is_home ? '(H)' : '(A)') : ''}`,
              difficulty: o.difficulty,
            }))
          : null;

        return (
          <Box key={ gw } sx={ { textAlign: 'center' } }>
            <Typography
              variant='body2'
              fontWeight='bold'
              color={ pointsColor }
              display='block'
              sx={ { lineHeight: 1.3 } }
            >
              { Math.round(points) }
            </Typography>
            { fixtures ? (
              <FixturePill fixtures={ fixtures } size='sm' />
            ) : (
              <Typography variant='caption' color='text.secondary' sx={ { fontSize: '0.6rem' } }>-</Typography>
            ) }
          </Box>
        );
      }) }
      { showDiff && (
        <Chip
          label={ diffLabel }
          size='small'
          color={ diffColor }
          sx={ { height: 18, fontSize: '0.65rem', alignSelf: 'center' } }
        />
      ) }
    </Box>
  );
};

PointsFixturesForecast.propTypes = {
  gwData: PropTypes.arrayOf(
    PropTypes.shape({
      gw: PropTypes.number.isRequired,
      points: PropTypes.number.isRequired,
      opponents: PropTypes.arrayOf(
        PropTypes.shape({
          opponent_short: PropTypes.string,
          is_home: PropTypes.bool,
          difficulty: PropTypes.number,
        })
      ),
    })
  ).isRequired,
  pointsColor: PropTypes.string,
  diff: PropTypes.number,
};

export default PointsFixturesForecast;
