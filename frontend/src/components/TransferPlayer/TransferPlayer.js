import React, { useState } from 'react';
import PropTypes from 'prop-types';
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
import { useTheme } from '@mui/material/styles';

// props: team, allPlayers, onTransfer, playerOut, open, onClose
const TransferPlayer = ({ team, allPlayers, onTransfer, playerOut, open, onClose }) => {
    const theme = useTheme();
    const [selectedIn, setSelectedIn] = useState(null);

    // Defensive: handle missing playerOut
    if (!playerOut) return null;

    // Use id for unique player, fallback to code if needed
    const getId = (p) => p.id ?? p.code;
    // Defensive: FPL API sometimes uses element_type for position
    const getPosition = (p) => p.position ?? p.element_type;
    const playerOutPosition = getPosition(playerOut);
    // Prevent duplicates: exclude any player already in the team by id or code
    const teamIds = new Set(team.map(tp => tp.id ?? tp.code));
    const availablePlayers = allPlayers.filter(
        (p) =>
            getPosition(p) === playerOutPosition &&
            !teamIds.has(p.id) &&
            !teamIds.has(p.code) &&
            getId(p) !== getId(playerOut)
    );

    const handleCloseDialog = () => {
        setSelectedIn(null);
        if (onClose) onClose();
    };

    const handleTransfer = () => {
        if (playerOut && selectedIn) {
            onTransfer(playerOut, selectedIn);
            handleCloseDialog();
        }
    };

    return (
        <Dialog 
            open={ open || false } 
            onClose={ handleCloseDialog }
                PaperProps={ {
                    sx: {
                        background: theme.palette.mode === 'dark' 
                            ? 'linear-gradient(135deg, #23272f 0%, #281455 100%)'
                            : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                        borderRadius: '12px',
                    }
                } }
            >
                <DialogTitle sx={ { color: theme.palette.text.primary } }>Transfer Player</DialogTitle>
                <DialogContent>
                    { /* Player Out: fixed, not a dropdown */ }
                    <ListItem>
                        <ListItemText primary={ playerOut.name } secondary={ playerOut.position } />
                    </ListItem>
                    { /* Player In: dropdown, only matching position */ }
                    <Autocomplete
                        options={ availablePlayers }
                        getOptionLabel={ (option) => option.web_name || option.webName || option.name }
                        value={ selectedIn }
                        onChange={ (_, value) => setSelectedIn(value) }
                        renderInput={ (params) => <TextField { ...params } label='Player In' margin='normal' /> }
                        renderOption={ (props, option) => (
                            <ListItem { ...props } key={ option.id }>
                                <ListItemText primary={ option.web_name || option.webName || option.name } secondary={ option.position } />
                            </ListItem>
                        ) }
                    />
                </DialogContent>
                <DialogActions sx={ { pb: 2, px: 3 } }>
                    <Button onClick={ handleCloseDialog } variant='outlined'>Cancel</Button>
                    <Button onClick={ handleTransfer } disabled={ !selectedIn } variant='contained' color='primary'>
                        Confirm Transfer
                    </Button>
                </DialogActions>
            </Dialog>
    );
};

TransferPlayer.propTypes = {
    team: PropTypes.array.isRequired,
    allPlayers: PropTypes.array.isRequired,
    onTransfer: PropTypes.func.isRequired,
    playerOut: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        code: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        name: PropTypes.string,
        position: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        element_type: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }).isRequired,
    open: PropTypes.bool,
    onClose: PropTypes.func,
};

export default TransferPlayer;
