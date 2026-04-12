import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Paper, Typography, List, ListItem, ListItemText, Divider, Button, Box } from '@mui/material';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import RemoveIcon from '@mui/icons-material/Remove';
import axios from '../../api';
import './styles.css';

const getRankChangeIcon = (current, last) => {
  if (last == null || current == null) return <RemoveIcon className='u-fs-md rank-neutral' />;
  if (last > current) return <ArrowDropUpIcon className='u-fs-md rank-up' />;
  if (last < current) return <ArrowDropDownIcon className='u-fs-md rank-down' />;
  return <RemoveIcon className='u-fs-md rank-neutral' />;
};

const UserProfilePane = ({ entryId, onLeagueClick }) => {
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
      <Box className='profile-header u-mb-0p5'>
        <Typography variant='h6' className='u-mb-0'>
          { profile.entry.player_first_name } { profile.entry.player_last_name }
        </Typography>
        <Typography variant='body2' color='text.secondary'>
          ({ profile.entry.name })
        </Typography>
      </Box>
      <Typography variant='body2' className='u-mb-0p5'>
        Points: <b>{ formatNumber(profile.totalPoints) }</b> | Overall: <b>{ formatNumber(profile.entry.summary_overall_rank) }</b>
      </Typography>
      <Divider className='u-my-1' />

      <Box className='profile-leagues-container'>
        { /* General Leagues - Left Column */ }
        <Box className='profile-league-col'>
          <Typography variant='subtitle2' className='u-mt-1'>General Leagues</Typography>
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
        <Box className='profile-league-col'>
          <Typography variant='subtitle2' className='u-mt-1'>Invitational Leagues</Typography>
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
                      className='league-link-btn'
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
