import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

const TeamIdDialog = ({ open, onSubmit }) => {
  const theme = useTheme();
  const [teamId, setTeamId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!teamId || !/^\d+$/.test(teamId)) {
      setError('Please enter a valid numeric Team ID');
      return;
    }
    setError('');
    onSubmit(teamId);
    setTeamId('');
  };

  return (
    <Dialog
      open={ open }
      slotProps={ {
        paper: {
          sx: {
            background: theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, #23272f 0%, #281455 100%)'
              : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
            borderRadius: '12px',
          }
        }
      } }
    >
      <DialogTitle sx={ { color: theme.palette.text.primary } }>
        Enter Your FPL Team ID
      </DialogTitle>
      <form
        onSubmit={ e => {
          e.preventDefault();
          handleSubmit();
        } }
      >
        <DialogContent>
          <Typography variant='body2' sx={ { mb: 2 } }>
            Enter your FPL Team ID to view your team and get transfer recommendations.
            You can find your Team ID on the FPL website in the URL when viewing your team.
          </Typography>
          <TextField
            autoFocus
            margin='dense'
            label='FPL Team ID'
            fullWidth
            value={ teamId }
            onChange={ e => {
              const val = e.target.value.replace(/\D/g, '');
              setTeamId(val);
              setError('');
            } }
            slotProps={ {
              input: {
                inputMode: 'numeric',
                pattern: '[0-9]*'
              }
            } }
            error={ !!error }
            helperText={ error }
          />
        </DialogContent>
        <DialogActions>
          <Button type='submit' variant='contained' color='primary' disabled={ !teamId }>
            Save Team ID
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

TeamIdDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default TeamIdDialog;
