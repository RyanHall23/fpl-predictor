import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Button, Typography, CircularProgress, Chip } from '@mui/material';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import useAssistantManager from '../../hooks/useAssistantManager';

// Maps hint.type → MUI Chip color
const TYPE_CHIP_COLOR = {
  warning: 'warning',
  captain: 'secondary',
  opportunity: 'success',
  info: 'info',
};

// Hint priority → CSS class
function hintPriorityClass(priority) {
  if (priority === 1) return 'hint-card hint-priority-1';
  if (priority === 2) return 'hint-card hint-priority-2';
  return 'hint-card hint-priority-3';
}

// Players with a trend field get a directional arrow label suffix
function playerLabel(p) {
  if (!p.trend) return p.name;
  return p.trend === 'rising' ? `${p.name} ▲` : `${p.name} ▼`;
}

const AssistantManagerPanel = ({ entryId, currentGameweek }) => {
  const { hints, loading, error, retry } = useAssistantManager(entryId, currentGameweek);

  return (
    <Box>
      { /* Header */ }
      <Box className='u-flex u-items-center u-gap-1 u-mb-1p5'>
        <LightbulbOutlinedIcon className='assistant-lightbulb' />
        <Typography variant='h6' className='u-font-600'>
          Assistant Manager
        </Typography>
      </Box>

      { /* Loading */ }
      { loading && (
        <Box className='u-flex u-justify-center u-py-2'>
          <CircularProgress size={ 20 } />
        </Box>
      ) }

      { /* Error state */ }
      { !loading && error && (
        <Alert
          severity='error'
          className='u-mb-1'
          action={
            <Button
              color='inherit'
              size='small'
              onClick={ retry }
              startIcon={ <RefreshIcon /> }
            >
              Retry
            </Button>
          }
        >
          Failed to load suggestions. Please try again.
        </Alert>
      ) }

      { /* Empty state */ }
      { !loading && !error && hints.length === 0 && (
        <Typography variant='body2' color='text.secondary'>
          No suggestions for this gameweek.
        </Typography>
      ) }

      { /* Hints list */ }
      { !loading && !error && hints.length > 0 && (
        <Box className='u-flex u-flex-col u-gap-2'>
          { hints.map((hint) => (
            <Box key={ hint.id } className={ hintPriorityClass(hint.priority) }>
              { /* Title row */ }
              <Box className='hint-title-row'>
                <Typography variant='body2' fontWeight={ 600 }>
                  { hint.title }
                </Typography>
                { hint.type && (
                  <Chip
                    label={ hint.type.charAt(0).toUpperCase() + hint.type.slice(1) }
                    size='small'
                    color={ TYPE_CHIP_COLOR[hint.type] || 'default' }
                    variant='outlined'
                    className='chip-hint'
                  />
                ) }
              </Box>

              { /* Message */ }
              <Typography
                variant='body2'
                color='text.secondary'
                className='u-line-1p55 u-pre-line'
              >
                { hint.message }
              </Typography>

              { /* Player chips */ }
              { hint.players && hint.players.length > 0 && (
                <Box className='hint-chips-row'>
                  { hint.players.slice(0, 6).map((p) => (
                    <Chip
                      key={ p.id ?? p.name }
                      label={ playerLabel(p) }
                      size='small'
                      variant='outlined'
                      className='chip-player'
                    />
                  )) }
                </Box>
              ) }

              { /* Team chips */ }
              { hint.teams && hint.teams.length > 0 && (
                <Box className='hint-chips-row'>
                  { hint.teams.map((t) => (
                    <Chip
                      key={ t.id }
                      label={ t.shortName ?? t.name }
                      size='small'
                      variant='outlined'
                      className='chip-player'
                    />
                  )) }
                </Box>
              ) }
            </Box>
          )) }
        </Box>
      ) }
    </Box>
  );
};

AssistantManagerPanel.propTypes = {
  entryId: PropTypes.string,
  currentGameweek: PropTypes.number,
};

export default AssistantManagerPanel;
