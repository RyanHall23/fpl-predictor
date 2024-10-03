import React from 'react';
import { Snackbar } from '@mui/material';

const Toast = ({ message }) => {
  return (
    <Snackbar open={!!message} message={message} autoHideDuration={3000} />
  );
};

export default Toast;
