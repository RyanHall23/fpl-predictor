import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, CircularProgress, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import useAssistantManager from '../../hooks/useAssistantManager';

// Maps hint.type → MUI Chip color
const TYPE_CHIP_COLOR = {
  warning: 'warning',
  captain: 'secondary',
  opportunity: 'success',
  info: 'info',
};

// Maps hint.priority → left-border colour key (resolved at render time)
function borderColor(theme, priority) {
  if (priority === 1) return theme.palette.warning.main;
  if (priority === 2) return theme.palette.info.main;
  return theme.palette.text.disabled;
}

// Players with a trend field get a directional arrow label suffix
function playerLabel(p) {
  if (!p.trend) return p.name;
  return p.trend === 'rising' ? `${p.name} ▲` : `${p.name} ▼`;
}

const AssistantManagerPanel = ({ entryId, currentGameweek }) => {
  const theme = useTheme();
  const { hints, loading } = useAssistantManager(entryId, currentGameweek);

  return (
    <Box>
      { /* Header */ }
      <Box sx={ { display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 } }>
        <LightbulbOutlinedIcon
          sx={ { fontSize: 20, color: theme.palette.warning.main } }
        />
        <Typography variant='h6' sx={ { fontWeight: 600 } }>
          Assistant Manager
        </Typography>
      </Box>

      { /* Loading */ }
      { loading && (
        <Box sx={ { display: 'flex', justifyContent: 'center', py: 2 } }>
          <CircularProgress size={ 20 } />
        </Box>
      ) }

      { /* Empty state */ }
      { !loading && hints.length === 0 && (
        <Typography variant='body2' color='text.secondary'>
          No suggestions for this gameweek.
        </Typography>
      ) }

      { /* Hints list */ }
      { !loading && hints.length > 0 && (
        <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2 } }>
          { hints.map((hint) => (
            <Box
              key={ hint.id }
              sx={ {
                borderLeft: `3px solid ${borderColor(theme, hint.priority)}`,
                pl: 1.5,
                py: 0.25,
              } }
            >
              { /* Title row */ }
              <Box
                sx={ {
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 0.75,
                  mb: 0.5,
                } }
              >
                <Typography variant='body2' fontWeight={ 600 }>
                  { hint.title }
                </Typography>
                { hint.type && (
                  <Chip
                    label={ hint.type.charAt(0).toUpperCase() + hint.type.slice(1) }
                    size='small'
                    color={ TYPE_CHIP_COLOR[hint.type] || 'default' }
                    variant='outlined'
                    sx={ { height: 18, fontSize: '0.65rem', lineHeight: 1 } }
                  />
                ) }
              </Box>

              { /* Message */ }
              <Typography
                variant='body2'
                color='text.secondary'
                sx={ { lineHeight: 1.55 } }
              >
                { hint.message }
              </Typography>

              { /* Player chips */ }
              { hint.players && hint.players.length > 0 && (
                <Box
                  sx={ { display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 } }
                >
                  { hint.players.slice(0, 6).map((p) => (
                    <Chip
                      key={ p.id ?? p.name }
                      label={ playerLabel(p) }
                      size='small'
                      variant='outlined'
                      sx={ { height: 20, fontSize: '0.7rem' } }
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
