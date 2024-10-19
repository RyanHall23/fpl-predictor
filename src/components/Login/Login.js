// src/components/Login/Login.js
import React, { useState } from 'react';
import { TextField, Button, Container, Typography } from '@mui/material';
import axios from 'axios';

const Login = ({ onLogin, onToggle }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/login', { username, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('username', username); // Store username in local storage
      onLogin();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <Container>
      <Typography variant='h4'>Login</Typography>
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
      <Button variant='contained' color='primary' onClick={ handleLogin }>
        Login
      </Button>
      <Button onClick={ onToggle }>Don't have an account? Sign Up</Button>
    </Container>
  );
};

export default Login;
