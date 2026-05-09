import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';
import InvitationLeagueView from '../InvitationLeagueView/InvitationLeagueView';
import FixturesPanel from '../FixturesPanel';
import axios from '../../api';

const RightPanel = ({ 
  entryId,
  userEntryId,
  onViewTeam,
  currentGameweek,
  selectedGameweek,
  gameweekDeadline,
  liveMatches,
  activeSection,
}) => {
  const theme = useTheme();
  const displayGameweek = selectedGameweek || currentGameweek;

  const [invLeagues, setInvLeagues] = useState([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState('');
  const [gwMode, setGwMode] = useState(null); // { label, color, isFuture }

  const storageKey = userEntryId ? `selectedLeagueId_${userEntryId}` : null;

  useEffect(() => {
    if (!entryId) { setInvLeagues([]); setSelectedLeagueId(''); return; }
    axios.get(`/api/entry/${entryId}/profile`)
      .then(res => {
        const leagues = (res.data.classicLeagues || []).filter(l => l.league_type !== 's');
        setInvLeagues(leagues);
        setSelectedLeagueId(() => {
          const stored = storageKey ? localStorage.getItem(storageKey) : null;
          const storedId = stored ? parseInt(stored, 10) : null;
          if (storedId && leagues.some(l => l.id === storedId)) return storedId;
          return leagues.length ? leagues[0].id : '';
        });
      })
      .catch(() => { setInvLeagues([]); setSelectedLeagueId(''); });
  }, [entryId, storageKey]);

  const handleLeagueChange = (id) => {
    setSelectedLeagueId(id);
    setGwMode(null); // reset chip until new league data loads
    if (storageKey) localStorage.setItem(storageKey, String(id));
  };

  const selectedLeague = invLeagues.find(l => l.id === selectedLeagueId) || null;

  return (
    <Box
      sx={ {
        width: '100%',
        height: '100%',
        backgroundColor: theme.palette.background.paper,
        borderRadius: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      } }
    >
      { entryId && invLeagues.length > 0 && (
        <Box>
          <Box sx={ { display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, flexWrap: 'wrap', px: 1, pt: 1 } }>
            <Typography variant='h6' sx={ { fontWeight: 600 } }>
              League Standings
            </Typography>
            { gwMode && (
              <Chip
                label={ gwMode.label }
                color={ gwMode.color }
                size='small'
                variant={ gwMode.isFuture ? 'filled' : 'outlined' }
              />
            ) }
            <Box sx={ { flex: 1 } } />
            { invLeagues.length > 1 && (
              <FormControl size='small' sx={ { minWidth: 160 } }>
                <InputLabel>League</InputLabel>
                <Select
                  value={ selectedLeagueId }
                  onChange={ e => handleLeagueChange(e.target.value) }
                  label='League'
                >
                  { invLeagues.map(l => (
                    <MenuItem key={ l.id } value={ l.id }>{ l.name }</MenuItem>
                  )) }
                </Select>
              </FormControl>
            ) }
          </Box>
          { selectedLeague && (
            <InvitationLeagueView
              league={ selectedLeague }
              onViewTeam={ onViewTeam }
              currentGameweek={ currentGameweek }
              selectedGameweek={ selectedGameweek }
              onModeChange={ setGwMode }
              userEntryId={ userEntryId }
            />
          ) }
        </Box>
      ) }

      { displayGameweek && (
        <>
          { entryId && invLeagues.length > 0 && <Divider sx={ { my: 1 } } /> }
          <Box sx={ { p: 2 } }>
            <FixturesPanel gameweek={ displayGameweek } deadline={ gameweekDeadline } liveMatches={ liveMatches } />
          </Box>
        </>
      ) }
    </Box>
  );
};

RightPanel.propTypes = {
  entryId: PropTypes.string,
  userEntryId: PropTypes.string,
  onViewTeam: PropTypes.func,
  currentGameweek: PropTypes.number,
  selectedGameweek: PropTypes.number,
  gameweekDeadline: PropTypes.string,
  liveMatches: PropTypes.array,
  activeSection: PropTypes.string,
};

export default RightPanel;
