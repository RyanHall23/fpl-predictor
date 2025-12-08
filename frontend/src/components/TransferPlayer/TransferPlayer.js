import React, { useState } from 'react';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';


// props: team, allPlayers, onTransfer, playerOut
const TransferPlayer = ({ team, allPlayers, onTransfer, playerOut }) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedIn, setSelectedIn] = useState(null);


    // Defensive: handle missing playerOut
    if (!playerOut) return null;

    // Use id for unique player, fallback to code if needed
    const getId = (p) => p.id ?? p.code;
    // Defensive: FPL API sometimes uses element_type for position
    const getPosition = (p) => p.position ?? p.element_type;
    const playerOutPosition = getPosition(playerOut);
    // Only allow transfer to same position, and not already in team
    const availablePlayers = allPlayers.filter(
        (p) =>
            getPosition(p) === playerOutPosition &&
            !team.some((tp) => getId(tp) === getId(p)) &&
            getId(p) !== getId(playerOut)
    );
    // DEBUG: Uncomment to see why options may be empty
    // console.log('playerOut', playerOut, 'playerOutPosition', playerOutPosition, 'team', team, 'allPlayers', allPlayers, 'availablePlayers', availablePlayers);

    const handleOpenDialog = () => {
        setDialogOpen(true);
        setSelectedIn(null);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
    };

    const handleTransfer = () => {
        if (playerOut && selectedIn) {
            onTransfer(playerOut, selectedIn);
            setDialogOpen(false);
        }
    };

    return (
        <>
            <ButtonGroup variant='contained'>
                <IconButton
                    onClick={ handleOpenDialog }
                    size='small'
                    className='action-button'
                >
                    <ArrowForwardIcon />
                </IconButton>
                <IconButton
                    disabled
                    size='small'
                    className='action-button'
                >
                    <ArrowBackIcon />
                </IconButton>
            </ButtonGroup>
            <Dialog open={ dialogOpen } onClose={ handleCloseDialog }>
                <DialogTitle>Transfer Player</DialogTitle>
                <DialogContent>
                    { /* Player Out: fixed, not a dropdown */ }
                    <ListItem>
                        <ListItemText primary={ playerOut.name } secondary={ playerOut.position } />
                    </ListItem>
                    { /* Player In: dropdown, only matching position */ }
                    <Autocomplete
                        options={ availablePlayers }
                        getOptionLabel={ (option) => option.name }
                        value={ selectedIn }
                        onChange={ (_, value) => setSelectedIn(value) }
                        renderInput={ (params) => <TextField { ...params } label='Player In' margin='normal' /> }
                        renderOption={ (props, option) => (
                            <ListItem { ...props } key={ option.id }>
                                <ListItemText primary={ option.name } secondary={ option.position } />
                            </ListItem>
                        ) }
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={ handleCloseDialog }>Cancel</Button>
                    <Button onClick={ handleTransfer } disabled={ !selectedIn } variant='contained' color='primary'>
                        Confirm Transfer
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default TransferPlayer;
