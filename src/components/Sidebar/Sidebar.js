import * as React from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

const Sidebar = ({ entryId, setEntryId, handleEntryIdSubmit }) => {
  const [open, setOpen] = React.useState(false);

  const toggleDrawer = (newOpen) => () => {
    setOpen(newOpen);
  };

  const handleSubmit = () => {
    handleEntryIdSubmit();
    setOpen(false);
  };

  const DrawerList = (
    <Box sx={ { width: 250, padding: 2 } } role="presentation">
      <TextField
        label="Enter Team ID"
        value={ entryId }
        onChange={ (e) => setEntryId(e.target.value) }
        fullWidth
        sx={ { marginBottom: 2 } }
      />
      <Button variant="contained" onClick={ handleSubmit } fullWidth>
        Submit
      </Button>
    </Box>
  );

  return (
    <div>
      <Button onClick={ toggleDrawer(true) }>Open drawer</Button>
      <Drawer open={ open } onClose={ toggleDrawer(false) }>
        { DrawerList }
      </Drawer>
    </div>
  );
};

Sidebar.propTypes = {
  entryId: PropTypes.string.isRequired,
  setEntryId: PropTypes.func.isRequired,
  handleEntryIdSubmit: PropTypes.func.isRequired,
};

export default Sidebar;