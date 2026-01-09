import React from 'react';
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

const isNumeric = (value) => /^\d*$/.test(value);

const AuthDialog = ({
  open,
  mode,
  form,
  error,
  onClose,
  onChange,
  onSubmit
}) => {
  const theme = useTheme();
  // Show error if in register mode and teamid is not numeric and not empty
  const teamIdError = mode === 'register' && form.teamid && !isNumeric(form.teamid);

  // Disable register if teamid is not numeric or empty
  const disableRegister = mode === 'register' && (!form.teamid || teamIdError);

  // Always allow the change, validation will handle errors
  const handleChange = (e) => {
    onChange(e);
  };

  return (
    <Dialog 
      open={ open } 
      onClose={ onClose }
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
        { mode === 'login' ? 'Login' : 'Register' }
      </DialogTitle>
      <form
        onSubmit={ e => {
          e.preventDefault();
          if (!disableRegister) onSubmit();
        } }
      >
        <DialogContent>
          <TextField
            autoFocus
            margin='dense'
            label='Username'
            name='username'
            fullWidth
            value={ form.username }
            onChange={ onChange }
          />
          <TextField
            margin='dense'
            label='Password'
            name='password'
            type='password'
            fullWidth
            value={ form.password }
            onChange={ onChange }
          />
          { mode === 'register' && (
            <TextField
              margin='dense'
              label='Team ID'
              name='teamid'
              fullWidth
              value={ form.teamid }
              onChange={ handleChange }
              error={ !!teamIdError }
              helperText={ teamIdError ? 'Team ID must only contain numbers' : '' }
            />
          ) }
          { error && <Typography color='error'>{ error }</Typography> }
        </DialogContent>
        <DialogActions>
          <Button onClick={ onClose } variant='outlined'>Cancel</Button>
          <Button type='submit' disabled={ disableRegister } variant='contained' color='primary'>
            { mode === 'login' ? 'Login' : 'Register' }
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

AuthDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf(['login', 'register']).isRequired,
  form: PropTypes.shape({
    username: PropTypes.string,
    password: PropTypes.string,
    teamid: PropTypes.string
  }).isRequired,
  error: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired
};

export default AuthDialog;
