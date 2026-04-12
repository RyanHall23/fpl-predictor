import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  Divider,
  Grid,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import axios from '../../api';

const AccountPage = ({ token, onTokenUpdate, onLogout }) => {
  const [profile, setProfile] = useState({ username: '', email: '', teamid: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [usernameForm, setUsernameForm] = useState('');
  const [emailForm, setEmailForm] = useState('');
  const [teamidForm, setTeamidForm] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [deleteAccountForm, setDeleteAccountForm] = useState({
    password: '',
    confirmDelete: false
  });

  const loadProfile = useCallback(async () => {
    try {
      const res = await axios.get('/api/auth/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(res.data);
      setUsernameForm(res.data.username);
      setEmailForm(res.data.email || '');
      setTeamidForm(res.data.teamid);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load profile:', err);
      if (err && err.response && err.response.status === 401) {
        if (typeof onLogout === 'function') {
          onLogout();
        }
        return;
      }
      setError('Failed to load profile');
      setLoading(false);
    }
  }, [token, onLogout]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleUpdateUsername = async () => {
    setError(''); setSuccess('');
    try {
      const res = await axios.put('/api/auth/username',
        { username: usernameForm },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Username updated successfully');
      setProfile({ ...profile, username: usernameForm });
      if (res.data.token) onTokenUpdate(res.data.token, usernameForm, profile.teamid);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update username');
    }
  };

  const handleUpdateEmail = async () => {
    setError(''); setSuccess('');
    try {
      await axios.put('/api/auth/email',
        { email: emailForm },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Email updated successfully');
      setProfile({ ...profile, email: emailForm });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update email');
    }
  };

  const handleUpdateTeamId = async () => {
    setError(''); setSuccess('');
    if (!teamidForm || !/^\d+$/.test(teamidForm)) {
      setError('Team ID must be a valid number');
      return;
    }
    try {
      const res = await axios.put('/api/auth/teamid',
        { teamid: teamidForm },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Team ID updated successfully');
      setProfile({ ...profile, teamid: teamidForm });
      if (res.data.token) onTokenUpdate(res.data.token, profile.username, teamidForm);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update team ID');
    }
  };

  const handleUpdatePassword = async () => {
    setError(''); setSuccess('');
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setError('All password fields are required');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    try {
      await axios.put('/api/auth/password',
        { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('Password updated successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password');
    }
  };

  const handleDeleteAccount = async () => {
    setError(''); setSuccess('');
    if (!deleteAccountForm.password) {
      setError('Password is required to delete account');
      return;
    }
    if (!deleteAccountForm.confirmDelete) {
      setError('You must confirm account deletion');
      return;
    }
    try {
      await axios.delete('/api/auth/account', {
        headers: { Authorization: `Bearer ${token}` },
        data: { password: deleteAccountForm.password, confirmDelete: deleteAccountForm.confirmDelete }
      });
      onLogout();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete account');
    }
  };

  if (loading) {
    return (
      <Container maxWidth='md' className='u-mt-4'>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth='md' className='u-mt-4 u-mb-4'>
      <Typography variant='h4' component='h1' gutterBottom>
        Account Settings
      </Typography>

      { error && (
        <Alert severity='error' className='u-mb-2' onClose={ () => setError('') }>
          { error }
        </Alert>
      ) }

      { success && (
        <Alert severity='success' className='u-mb-2' onClose={ () => setSuccess('') }>
          { success }
        </Alert>
      ) }

      { /* Username */ }
      <Paper className='u-p-3 u-mb-3'>
        <Typography variant='h6' gutterBottom>Username</Typography>
        <Grid container spacing={ 2 } alignItems='center'>
          <Grid item xs={ 12 } sm={ 8 }>
            <TextField fullWidth label='Username' value={ usernameForm }
              onChange={ (e) => setUsernameForm(e.target.value) } variant='outlined' />
          </Grid>
          <Grid item xs={ 12 } sm={ 4 }>
            <Button fullWidth variant='contained' color='primary' onClick={ handleUpdateUsername }
              disabled={ usernameForm === profile.username || !usernameForm }>
              Update Username
            </Button>
          </Grid>
        </Grid>
      </Paper>

      { /* Email */ }
      <Paper className='u-p-3 u-mb-3'>
        <Typography variant='h6' gutterBottom>Email</Typography>
        <Grid container spacing={ 2 } alignItems='center'>
          <Grid item xs={ 12 } sm={ 8 }>
            <TextField fullWidth label='Email (Optional)' type='email' value={ emailForm }
              onChange={ (e) => setEmailForm(e.target.value) } variant='outlined' />
          </Grid>
          <Grid item xs={ 12 } sm={ 4 }>
            <Button fullWidth variant='contained' color='primary' onClick={ handleUpdateEmail }
              disabled={ emailForm === (profile.email || '') }>
              Update Email
            </Button>
          </Grid>
        </Grid>
      </Paper>

      { /* Team ID */ }
      <Paper className='u-p-3 u-mb-3'>
        <Typography variant='h6' gutterBottom>Team ID</Typography>
        <Grid container spacing={ 2 } alignItems='center'>
          <Grid item xs={ 12 } sm={ 8 }>
            <TextField fullWidth label='Team ID' value={ teamidForm }
              onChange={ (e) => { const val = e.target.value.replace(/\D/g, ''); setTeamidForm(val); } }
              variant='outlined' inputProps={ { inputMode: 'numeric', pattern: '[0-9]*' } } />
          </Grid>
          <Grid item xs={ 12 } sm={ 4 }>
            <Button fullWidth variant='contained' color='primary' onClick={ handleUpdateTeamId }
              disabled={ teamidForm === profile.teamid || !teamidForm }>
              Update Team ID
            </Button>
          </Grid>
        </Grid>
      </Paper>

      { /* Change Password */ }
      <Paper className='u-p-3 u-mb-3'>
        <Typography variant='h6' gutterBottom>Change Password</Typography>
        <Box className='account-password-fields'>
          <TextField fullWidth label='Current Password' type='password'
            value={ passwordForm.currentPassword }
            onChange={ (e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value }) }
            variant='outlined' />
          <TextField fullWidth label='New Password' type='password'
            value={ passwordForm.newPassword }
            onChange={ (e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value }) }
            variant='outlined' />
          <TextField fullWidth label='Confirm New Password' type='password'
            value={ passwordForm.confirmPassword }
            onChange={ (e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value }) }
            variant='outlined' />
          <Button variant='contained' color='primary' onClick={ handleUpdatePassword }
            disabled={ !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword }>
            Update Password
          </Button>
        </Box>
      </Paper>

      <Divider className='u-my-3' />

      { /* Logout */ }
      <Paper className='u-p-3 u-mb-3'>
        <Typography variant='h6' gutterBottom>Logout</Typography>
        <Typography variant='body2' className='u-mb-2'>
          Logging out will clear your session. You&apos;ll need to log in again to access your account.
        </Typography>
        <Button variant='outlined' color='primary' onClick={ onLogout }>
          Logout
        </Button>
      </Paper>

      <Divider className='u-my-3' />

      { /* Danger Zone */ }
      <Paper className='u-p-3 section-danger'>
        <Typography variant='h6' gutterBottom color='error'>
          Danger Zone
        </Typography>
        <Box>
          <Typography variant='subtitle1' gutterBottom color='error' className='u-font-bold'>
            Delete Account
          </Typography>
          <Typography variant='body2' className='u-mb-2'>
            This action is permanent and cannot be undone. All your data will be permanently deleted from our database.
          </Typography>
          <Box className='account-password-fields'>
            <TextField fullWidth label='Enter your password to confirm' type='password'
              value={ deleteAccountForm.password }
              onChange={ (e) => setDeleteAccountForm({ ...deleteAccountForm, password: e.target.value }) }
              variant='outlined' size='small' />
            <FormControlLabel
              control={
                <Checkbox
                  checked={ deleteAccountForm.confirmDelete }
                  onChange={ (e) => setDeleteAccountForm({ ...deleteAccountForm, confirmDelete: e.target.checked }) }
                  color='error'
                />
              }
              label='I understand that this action is permanent and all my data will be deleted'
            />
            <Button variant='contained' color='error' onClick={ handleDeleteAccount }
              disabled={ !deleteAccountForm.password || !deleteAccountForm.confirmDelete }>
              Delete My Account Permanently
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

AccountPage.propTypes = {
  token: PropTypes.string.isRequired,
  onTokenUpdate: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired
};

export default AccountPage;
