import { Box, Typography } from '@mui/material';
import PropTypes from 'prop-types';

/**
 * Fixed slot dimensions per size variant.
 *  - sm  : formation cards  (9 px font, narrower)
 *  - md  : list-view rows   (11 px font)
 */
const SIZE_CLASS = {
  sm: 'fixture-pill-sm',
  md: 'fixture-pill-md',
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
 */
function FixturePill({ fixtures, size }) {
  if (!fixtures || fixtures.length === 0) return null;

  const sizeClass = SIZE_CLASS[size] ?? SIZE_CLASS.md;
  const items = fixtures.slice(0, 2);

  return (
    <Box className={ `fixture-pill ${sizeClass}` }>
      { items.map((fix, i) => {
        const diff = fix.difficulty ?? 0;
        const prevDiff = i > 0 ? (items[i - 1].difficulty ?? 0) : null;

        return (
          <Box key={ i } className='u-contents'>
            { i > 0 && (
              <Box className={ `fixture-pill-sep fdr-sep-from-${prevDiff}-to-${diff}` } />
            ) }
            <Box className={ `fixture-pill-slot fdr-${diff}` }>
              <Typography
                variant='caption'
                fontWeight='bold'
                component='span'
                color='inherit'
                className={ `${sizeClass}-text u-line-1p2 u-nowrap` }
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
