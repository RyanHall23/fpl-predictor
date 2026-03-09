import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Paper, Typography, List, ListItem, ListItemText, Divider, Button, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import RemoveIcon from '@mui/icons-material/Remove';
import axios from '../../api';
import './styles.css';

const getRankChangeIcon = (current, last) => {
  if (last == null || current == null) return <RemoveIcon sx={ { color: 'grey.500', fontSize: 18, verticalAlign: 'middle' } } />;
  if (last > current) return <ArrowDropUpIcon sx={ { color: 'green', fontSize: 18, verticalAlign: 'middle' } } />;
  if (last < current) return <ArrowDropDownIcon sx={ { color: 'red', fontSize: 18, verticalAlign: 'middle' } } />;
  return <RemoveIcon sx={ { color: 'grey.500', fontSize: 18, verticalAlign: 'middle' } } />;
};

const UserProfilePane = ({ entryId, onLeagueClick }) => {
  const theme = useTheme();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!entryId) return;
    axios.get(`/api/entry/${entryId}/profile`)
      .then(res => setProfile(res.data))
      .catch(() => setProfile(null));
  }, [entryId]);

  if (!entryId) return null;
  if (!profile) return <Paper className='user-profile-pane'>Loading profile...</Paper>;

  const classicLeagues = profile.classicLeagues || [];
  const invitationalLeagues = classicLeagues.filter(l => l.league_type !== 's');
  const generalLeagues = classicLeagues.filter(l => l.league_type === 's');

  const formatNumber = n => (n == null ? 'N/A' : n.toLocaleString());

  return (
    <Paper className='user-profile-pane' elevation={ 4 }>
      <Box sx={ { display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mb: 0.5 } }>
        <Typography variant='h6' sx={ { mb: 0 } }>
          { profile.entry.player_first_name } { profile.entry.player_last_name }
        </Typography>
        <Typography variant='body2' color='text.secondary'>
          ({ profile.entry.name })
        </Typography>
      </Box>
      <Typography variant='body2' sx={ { mb: 0.5 } }>
        Points: <b>{ formatNumber(profile.totalPoints) }</b> | Overall: <b>{ formatNumber(profile.entry.summary_overall_rank) }</b>
      </Typography>
      <Divider sx={ { my: 1 } } />

      <Box sx={ { display: 'flex', gap: 0, maxHeight: '400px', overflow: 'auto' } }>
        { /* General Leagues - Left Column */ }
        <Box sx={ { flex: 1, minWidth: 0 } }>
          <Typography variant='subtitle2' sx={ { mt: 1 } }>General Leagues</Typography>
          <List dense>
            { generalLeagues.length === 0 && (
              <ListItem disablePadding>
                <ListItemText primary='None' />
              </ListItem>
            ) }
            { generalLeagues.map(l => (
              <ListItem key={ l.id } disablePadding>
                <ListItemText
                  primary={ l.name }
                  secondary={
                    <>
                      Rank: { formatNumber(l.entry_rank) }{ ' ' }
                      { getRankChangeIcon(l.entry_rank, l.entry_last_rank) }
                    </>
                  }
                />
              </ListItem>
            )) }
          </List>
        </Box>

        { /* Invitational Leagues - Right Column */ }
        <Box sx={ { flex: 1, minWidth: 0 } }>
          <Typography variant='subtitle2' sx={ { mt: 1 } }>Invitational Leagues</Typography>
          <List dense>
            { invitationalLeagues.length === 0 && (
              <ListItem>
                <ListItemText primary='None' />
              </ListItem>
            ) }
            { invitationalLeagues.map(l => (
              <ListItem key={ l.id } disablePadding>
                <ListItemText
                  primary={
                    <Button
                      size='small'
                      variant='text'
                      onClick={ () => onLeagueClick && onLeagueClick(l) }
                      sx={ {
                        p: 0,
                        minWidth: 0,
                        textTransform: 'none',
                        fontWeight: 'normal',
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        color: 'inherit',
                        '&:hover': { textDecoration: 'underline', background: 'none' },
                      } }
                    >
                      { l.name }
                    </Button>
                  }
                  secondary={
                    <>
                      Rank: { formatNumber(l.entry_rank) }{ ' ' }
                      { getRankChangeIcon(l.entry_rank, l.entry_last_rank) }
                    </>
                  }
                />
              </ListItem>
            )) }
          </List>
        </Box>
      </Box>
    </Paper>
  );
};

UserProfilePane.propTypes = {
  entryId: PropTypes.string,
  onLeagueClick: PropTypes.func,
};

export default UserProfilePane;
