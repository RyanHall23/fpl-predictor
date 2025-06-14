import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Paper, Typography, List, ListItem, ListItemText, Divider, Button } from '@mui/material';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import RemoveIcon from '@mui/icons-material/Remove';
import axios from 'axios';

const getRankChangeIcon = (current, last) => {
  if (last == null || current == null) return <RemoveIcon sx={{ color: 'grey.500', fontSize: 18, verticalAlign: 'middle' }} />;
  if (last > current) return <ArrowDropUpIcon sx={{ color: 'green', fontSize: 18, verticalAlign: 'middle' }} />;
  if (last < current) return <ArrowDropDownIcon sx={{ color: 'red', fontSize: 18, verticalAlign: 'middle' }} />;
  return <RemoveIcon sx={{ color: 'grey.500', fontSize: 18, verticalAlign: 'middle' }} />;
};

const MAX_LEAGUES_DISPLAYED = 5;

const UserProfilePane = ({ entryId }) => {
  const [profile, setProfile] = useState(null);
  const [showAllInvitational, setShowAllInvitational] = useState(false);
  const [showAllGeneral, setShowAllGeneral] = useState(false);

  useEffect(() => {
    if (!entryId) return;
    axios.get(`/api/entry/${entryId}/profile`)
      .then(res => setProfile(res.data))
      .catch(() => setProfile(null));
  }, [entryId]);

  if (!entryId) return null;
  if (!profile) return <Paper sx={{ p: 2, minWidth: 250 }}>Loading profile...</Paper>;

  const classicLeagues = profile.classicLeagues || [];
  const invitationalLeagues = classicLeagues.filter(l => l.league_type !== 's');
  const generalLeagues = classicLeagues.filter(l => l.league_type === 's');

  const displayedInvitational = showAllInvitational ? invitationalLeagues : invitationalLeagues.slice(0, MAX_LEAGUES_DISPLAYED);
  const displayedGeneral = showAllGeneral ? generalLeagues : generalLeagues.slice(0, MAX_LEAGUES_DISPLAYED);

  return (
    <Paper sx={{ p: 2, minWidth: 250 }}>
      <Typography variant='h6' gutterBottom>
        {profile.entry.player_first_name} {profile.entry.player_last_name}
      </Typography>
      <Typography variant='subtitle2'>Team: {profile.entry.name}</Typography>
      <Divider sx={{ my: 1 }} />
      <Typography variant='body1'>Total Points: <b>{profile.totalPoints}</b></Typography>
      <Typography variant='body1'>
        Overall Rank: <b>{profile.entry.summary_overall_rank || 'N/A'}</b>
      </Typography>
      <Divider sx={{ my: 1 }} />

      {/* Invitational Leagues */}
      <Typography variant='subtitle2' sx={{ mt: 1 }}>Invitational Leagues</Typography>
      <List dense>
        {displayedInvitational.length === 0 && (
          <ListItem>
            <ListItemText primary="None" />
          </ListItem>
        )}
        {displayedInvitational.map(l => (
          <ListItem key={l.id}>
            <ListItemText
              primary={l.name}
              secondary={
                <>
                  Rank: {l.entry_rank}{' '}
                  {getRankChangeIcon(l.entry_rank, l.entry_last_rank)}
                </>
              }
            />
          </ListItem>
        ))}
      </List>
      {invitationalLeagues.length > MAX_LEAGUES_DISPLAYED && (
        <Button
          size="small"
          onClick={() => setShowAllInvitational(v => !v)}
          sx={{ mb: 1 }}
        >
          {showAllInvitational ? 'Show Less' : 'Show All'}
        </Button>
      )}

      {/* General Leagues */}
      <Typography variant='subtitle2' sx={{ mt: 2 }}>General Leagues</Typography>
      <List dense>
        {displayedGeneral.length === 0 && (
          <ListItem>
            <ListItemText primary="None" />
          </ListItem>
        )}
        {displayedGeneral.map(l => (
          <ListItem key={l.id}>
            <ListItemText
              primary={l.name}
              secondary={
                <>
                  Rank: {l.entry_rank}{' '}
                  {getRankChangeIcon(l.entry_rank, l.entry_last_rank)}
                </>
              }
            />
          </ListItem>
        ))}
      </List>
      {generalLeagues.length > MAX_LEAGUES_DISPLAYED && (
        <Button
          size="small"
          onClick={() => setShowAllGeneral(v => !v)}
          sx={{ mb: 1 }}
        >
          {showAllGeneral ? 'Show Less' : 'Show All'}
        </Button>
      )}
    </Paper>
  );
};

UserProfilePane.propTypes = {
  entryId: PropTypes.string,
};

export default UserProfilePane;