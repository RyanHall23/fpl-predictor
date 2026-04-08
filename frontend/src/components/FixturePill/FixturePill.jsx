import React from 'react';
import { Box, Typography } from '@mui/material';
import PropTypes from 'prop-types';

const FDR_COLORS = {
  1: { bg: '#00c853', text: '#000' },
  2: { bg: '#69f0ae', text: '#000' },
  3: { bg: '#ffee58', text: '#000' },
  4: { bg: '#ff7043', text: '#fff' },
  5: { bg: '#b71c1c', text: '#fff' },
};

/**
 * Fixed slot dimensions per size variant.
 *  - sm  : formation cards  (9 px font, narrower)
 *  - md  : list-view rows   (11 px font)
 *
 * slotMinWidth is applied per fixture segment in horizontal mode so that
 * all pills are the same width regardless of which letters appear in the
 * team abbreviation (e.g. "NEW" vs "LEE" render differently in proportional
 * fonts even though they have the same character count).
 */
const SIZE_CONFIG = {
  sm: { fontSize: '9px',  slotMinWidth: 44 },
  md: { fontSize: '11px', slotMinWidth: 60 },
};

/**
 * FixturePill
 *
 * Renders 1–2 fixture badges using the DGW container style
 * (borderRadius 6 px + overflow hidden) for both single and double gameweeks.
 *
 * Props:
 *   fixtures   – Array of { label: string, difficulty: number }.
 *                Pass at most two items; only the first two are rendered.
 *   direction  – 'horizontal' | 'vertical'  (default: 'horizontal')
 *                Controls how two fixtures are laid out side-by-side or stacked.
 *   size       – 'sm' | 'md'  (default: 'md')
 *                'sm' for formation cards, 'md' for list-view rows.
 */
function FixturePill({ fixtures, direction, size }) {
  if (!fixtures || fixtures.length === 0) return null;

  const { fontSize, slotMinWidth } = SIZE_CONFIG[size] ?? SIZE_CONFIG.md;
  const isHorizontal = direction !== 'vertical';
  const items = fixtures.slice(0, 2);

  return (
    <Box
      sx={ {
        display: 'inline-flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        borderRadius: '6px',
        overflow: 'hidden',
        flexShrink: 0,
        /* In vertical mode the pill fills the parent container width */
        width: isHorizontal ? undefined : '100%',
      } }
    >
      { items.map((fix, i) => {
        const fdr = FDR_COLORS[fix.difficulty] ?? { bg: '#888', text: '#fff' };
        const prevFdr = i > 0 ? (FDR_COLORS[items[i - 1].difficulty] ?? { bg: '#888', text: '#fff' }) : null;

        return (
          <React.Fragment key={ i }>
            { /* Angled diagonal separator between DGW fixtures in horizontal mode */ }
            { i > 0 && isHorizontal && (
              <Box sx={ {
                width: 8,
                flexShrink: 0,
                alignSelf: 'stretch',
                background: `linear-gradient(to bottom right, ${prevFdr.bg} 50%, ${fdr.bg} 50%)`,
              } } />
            ) }
            <Box
              sx={ {
                bgcolor: fdr.bg,
                color: fdr.text,
                px: 0.5,
                py: 0.25,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                /* Fixed minimum width keeps all pills consistent regardless of
                   the proportional width of the letters in the team abbreviation */
                minWidth: slotMinWidth,
                /* In vertical mode each row stretches to full container width */
                ...(isHorizontal ? {} : { width: '100%' }),
                /* Straight border separator for vertical DGW stacking */
                ...(i > 0 && !isHorizontal ? { borderTop: '1px solid rgba(0,0,0,0.15)' } : {}),
              } }
            >
              <Typography
                variant='caption'
                fontWeight='bold'
                component='span'
                color='inherit'
                sx={ { fontSize, lineHeight: 1.2, whiteSpace: 'nowrap' } }
              >
                { fix.label }
              </Typography>
            </Box>
          </React.Fragment>
        );
      }) }
    </Box>
  );
}

FixturePill.propTypes = {
  fixtures:  PropTypes.arrayOf(
    PropTypes.shape({
      label:      PropTypes.string.isRequired,
      difficulty: PropTypes.number,
    })
  ).isRequired,
  direction: PropTypes.oneOf([ 'horizontal', 'vertical' ]),
  size:      PropTypes.oneOf([ 'sm', 'md' ]),
};

FixturePill.defaultProps = {
  direction: 'horizontal',
  size:      'md',
};

export default FixturePill;
