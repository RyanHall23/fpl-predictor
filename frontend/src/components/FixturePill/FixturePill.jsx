import { Box, Typography } from '@mui/material';
import PropTypes from 'prop-types';

const FDR_COLORS = {
  1: { bg: '#00c853', text: '#000' },
  2: { bg: '#69f0ae', text: '#000' },
  3: { bg: '#c8960c', text: '#fff' },
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
  sm: { fontSize: '9px',  slotMinWidth: 44, borderRadius: '10px' },
  md: { fontSize: '11px', slotMinWidth: 60, borderRadius: '10px' },
};

/**
 * FixturePill
 *
 * Renders 1–2 fixture badges side-by-side with a diagonal separator for DGWs.
 *
 * Props:
 *   fixtures – Array of { label: string, difficulty: number }.
 *              Pass at most two items; only the first two are rendered.
 *   size     – 'sm' | 'md'  (default: 'md')
 *              'sm' for formation cards, 'md' for list-view rows.
 */
function FixturePill({ fixtures, size }) {
  if (!fixtures || fixtures.length === 0) return null;

  const { fontSize, slotMinWidth, borderRadius } = SIZE_CONFIG[size] ?? SIZE_CONFIG.md;
  const items = fixtures.slice(0, 2);

  return (
    <Box
      sx={ {
        display: 'inline-flex',
        flexDirection: 'row',
        borderRadius,
        overflow: 'hidden',
        flexShrink: 0,
      } }
    >
      { items.map((fix, i) => {
        const fdr = FDR_COLORS[fix.difficulty] ?? { bg: '#888', text: '#fff' };
        const prevFdr = i > 0 ? (FDR_COLORS[items[i - 1].difficulty] ?? { bg: '#888', text: '#fff' }) : null;

        return (
          <Box key={ i } sx={ { display: 'contents' } }>
            { i > 0 && (
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
                py: 0.15,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: slotMinWidth,
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
          </Box>
        );
      }) }
    </Box>
  );
}

FixturePill.propTypes = {
  fixtures: PropTypes.arrayOf(
    PropTypes.shape({
      label:      PropTypes.string.isRequired,
      difficulty: PropTypes.number,
    })
  ).isRequired,
  size: PropTypes.oneOf([ 'sm', 'md' ]),
};

FixturePill.defaultProps = {
  size: 'md',
};

export default FixturePill;
