import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';

// props: team, allPlayers, onTransfer, playerOut, open, onClose, currentGameweek, viewedGameweek
const TransferPlayer = ({ team, allPlayers, onTransfer, playerOut, open, onClose, currentGameweek, viewedGameweek }) => {
    // This dialog is only reachable from a future-GW view, so the earliest
    // plannable gameweek is always the one after the current GW.
    const minGameweek = currentGameweek ? currentGameweek + 1 : null;
    const [selectedIn, setSelectedIn] = useState(null);
    const [selectedGameweek, setSelectedGameweek] = useState(viewedGameweek || minGameweek);

    // Defensive: handle missing playerOut
    if (!playerOut) return null;

    // Use id for unique player, fallback to code if needed
    const getId = (p) => p.id ?? p.code;
    // Defensive: FPL API sometimes uses element_type for position
    const getPosition = (p) => p.position ?? p.element_type;
    const playerOutPosition = getPosition(playerOut);
    // Prevent duplicates: exclude any player already in the team by id or code
    const teamIds = new Set(team.map(tp => tp.id ?? tp.code));
    // Count players per club in the squad after playerOut leaves
    const clubCounts = {};
    for (const tp of team) {
        if ((tp.id ?? tp.code) === getId(playerOut)) continue; // playerOut is leaving
        const clubId = tp.team;
        if (clubId != null) clubCounts[clubId] = (clubCounts[clubId] || 0) + 1;
    }
    const availablePlayers = allPlayers
        .filter(
            (p) =>
                getPosition(p) === playerOutPosition &&
                !teamIds.has(p.id) &&
                !teamIds.has(p.code) &&
                getId(p) !== getId(playerOut) &&
                (clubCounts[p.team] ?? 0) < 3
        )
        .sort((a, b) => {
            const ptsA = parseFloat(a.ep_next) || 0;
            const ptsB = parseFloat(b.ep_next) || 0;
            return ptsB - ptsA; // Descending order
        });

    const handleCloseDialog = () => {
        setSelectedIn(null);
        setSelectedGameweek(minGameweek);
        if (onClose) onClose();
    };

    const handleTransfer = () => {
        if (playerOut && selectedIn) {
            onTransfer(playerOut, selectedIn, selectedGameweek);
            handleCloseDialog();
        }
    };

    return (
        <Dialog 
            open={ open || false } 
            onClose={ handleCloseDialog }
            PaperProps={ { className: 'dialog-paper-gradient' } }
            >
                <DialogTitle>Transfer Player</DialogTitle>
                <DialogContent>
                    { /* Player Out: fixed, not a dropdown */ }
                    <ListItem>
                        <ListItemText
                            primary={ playerOut.name }
                            secondary={ `${ { 1: 'Goalkeeper', 2: 'Defender', 3: 'Midfielder', 4: 'Forward', 5: 'Manager' }[playerOut.position] ?? playerOut.position }${ (playerOut.sellingPrice ?? playerOut.nowCost) != null ? ` · £${((playerOut.sellingPrice ?? playerOut.nowCost) / 10).toFixed(1)}m` : '' }` }
                        />
                    </ListItem>
                    { /* Player In: dropdown, only matching position */ }
                    <Autocomplete
                        options={ availablePlayers }
                        getOptionLabel={ (option) => option.web_name || option.webName || option.name }
                        value={ selectedIn }
                        onChange={ (_, value) => setSelectedIn(value) }
                        renderInput={ (params) => <TextField { ...params } label='Player In' margin='normal' /> }
                        renderOption={ (props, option) => {
                            // Format opponents for DGW support
                            let opponentText = '-';
                            if (option.opponents && Array.isArray(option.opponents) && option.opponents.length > 0) {
                                opponentText = option.opponents.map(opp => {
                                    const teamName = opp.opponent_short || '-';
                                    if (opp.is_home === null || opp.is_home === undefined) return teamName;
                                    return opp.is_home ? `${teamName} (H)` : `${teamName} (A)`;
                                }).join(', ');
                            } else if (option.opponent) {
                                opponentText = option.opponent;
                            }
                            
                            return (
                                <ListItem { ...props } key={ option.id }>
                                    <ListItemText 
                                        primary={ option.web_name || option.webName || option.name } 
                                        secondary={ `${Math.round(option.ep_next) || 0} pts · ${opponentText}${ (option.nowCost ?? option.now_cost) != null ? ` · £${((option.nowCost ?? option.now_cost) / 10).toFixed(1)}m` : '' }` } 
                                    />
                                </ListItem>
                            );
                        } }
                    />
                    { /* Gameweek selector – only shown for future gameweeks */ }
                    { minGameweek && (
                        <div className='u-mt-2'>
                            <FormControl fullWidth size='small'>
                                <InputLabel>Transfer in Gameweek</InputLabel>
                                <Select
                                    value={ selectedGameweek || minGameweek }
                                    onChange={ (e) => setSelectedGameweek(e.target.value) }
                                    label='Transfer in Gameweek'
                                >
                                    { Array.from({ length: 38 - minGameweek + 1 }, (_, i) => minGameweek + i).map((gw) => (
                                        <MenuItem key={ gw } value={ gw }>GW { gw }</MenuItem>
                                    )) }
                                </Select>
                            </FormControl>
                        </div>
                    ) }
                </DialogContent>
                <DialogActions className='dialog-actions-padded'>
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
    currentGameweek: PropTypes.number,
    viewedGameweek: PropTypes.number,
};

export default TransferPlayer;
