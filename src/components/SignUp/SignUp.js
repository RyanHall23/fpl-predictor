// src/components/SignUp/SignUp.js
import React, { useState } from 'react';
import { TextField, Button, Container, Typography } from '@mui/material';
import axios from 'axios';

const SignUp = ({ onSignUp }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [teamId, setTeamId] = useState('');
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/signup', { username, password, teamId });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('username', username);
      localStorage.setItem('teamId', teamId); // Store team ID in local storage
      onSignUp();
    } catch (error) {
      if (error.response && error.response.data.error) {
        setError(error.response.data.error);
      } else {
        console.error('Sign-up failed:', error);
      }
    }
  };

  return (
    <Container>
      <Typography variant='h4'>Sign Up</Typography>
      { error && <Typography color='error'>{ error }</Typography> }
      <TextField
        label='Username'
        value={ username }
        onChange={ (e) => setUsername(e.target.value) }
        fullWidth
        margin='normal'
      />
      <TextField
        label='Password'
        type='password'
        value={ password }
        onChange={ (e) => setPassword(e.target.value) }
        fullWidth
        margin='normal'
      />
      <TextField
        label='Team ID'
        value={ teamId }
        onChange={ (e) => setTeamId(e.target.value) }
        fullWidth
        margin='normal'
      />
      <Button variant='contained' color='primary' onClick={ handleSignUp }>
        Sign Up
      </Button>
    </Container>
  );
};

export default SignUp;
