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

const TeamIdDialog = ({ open, onClose, onSubmit }) => {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    setValue(val);
    setError('');
  };

  const handleSubmit = () => {
    if (!value) {
      setError('Team ID is required');
      return;
    }
    onSubmit(value);
    setValue('');
    setError('');
  };

  const handleClose = () => {
    setValue('');
    setError('');
    onClose();
  };

  return (
    <Dialog
      open={ open }
      onClose={ handleClose }
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
      <DialogTitle sx={ { color: theme.palette.text.primary } }>Set Team ID</DialogTitle>
      <form onSubmit={ (e) => { e.preventDefault(); handleSubmit(); } }>
        <DialogContent>
          <Typography variant='body2' sx={ { mb: 2 } }>
            Enter your FPL Team ID to view your team. You can find it in the URL of your FPL team page.
          </Typography>
          <TextField
            autoFocus
            margin='dense'
            label='Team ID'
            fullWidth
            value={ value }
            onChange={ handleChange }
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
          <Button onClick={ handleClose } variant='outlined'>Cancel</Button>
          <Button type='submit' variant='contained' color='primary' disabled={ !value }>
            Set Team ID
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

TeamIdDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default TeamIdDialog;
