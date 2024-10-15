import React, { useState } from 'react';
import { TextField, Button, Container, Typography } from '@mui/material';
import axios from 'axios';

const SignUp = ({ onSignUp }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSignUp = async () => {
    try {
      await axios.post('http://localhost:5000/api/signup', { username, password });
      onSignUp();
    } catch (error) {
      console.error('Sign-up failed:', error);
    }
  };

  return (
    <Container>
      <Typography variant='h4'>Sign Up</Typography>
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
      <Button variant='contained' color='primary' onClick={ handleSignUp }>
        Sign Up
      </Button>
    </Container>
  );
};

export default SignUp;
