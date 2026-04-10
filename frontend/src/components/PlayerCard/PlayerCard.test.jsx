import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PlayerCard from './PlayerCard';

// Avoid deep-rendering the transfer dialog
vi.mock('../TransferPlayer/TransferPlayer', () => ({
  default: () => <div data-testid="transfer-player" />,
}));

const mockPlayer = {
  webName: 'Salah',
  predictedPoints: 8,
  inDreamteam: false,
  code: 12345,
  position: 3, // MID
  teamCode: 14,
  team: 1,
  opponent: 'MCI (H)',
  opponentDisplay: 'MCI (H)',
  is_home: true,
  opponents: [],
};

describe('PlayerCard', () => {
  it('renders player name', () => {
    const { container } = render(<PlayerCard player={mockPlayer} />);
    expect(container).toHaveTextContent('Salah');
  });

  it('renders predicted points', () => {
    const { container } = render(<PlayerCard player={mockPlayer} />);
    expect(container.querySelector('.points-display')).toHaveTextContent('8');
  });

  it('renders opponent display', () => {
    const { container } = render(<PlayerCard player={mockPlayer} />);
    expect(container).toHaveTextContent('MCI (H)');
  });

  it('does NOT show captain badge when isCaptain={false}', () => {
    const { container } = render(<PlayerCard player={mockPlayer} isCaptain={false} />);
    expect(container.querySelector('.captain-badge')).toBeNull();
  });

  it('DOES show captain badge when isCaptain={true}', () => {
    const { container } = render(<PlayerCard player={mockPlayer} isCaptain={true} />);
    expect(container.querySelector('.captain-badge')).toBeInTheDocument();
  });

  it('does NOT show dreamteam star when inDreamteam={false}', () => {
    const { container } = render(
      <PlayerCard player={{ ...mockPlayer, inDreamteam: false }} />
    );
    expect(container.querySelector('.dreamteam-icon')).toBeNull();
  });

  it('DOES show dreamteam star icon when inDreamteam={true}', () => {
    const { container } = render(
      <PlayerCard player={{ ...mockPlayer, inDreamteam: true }} />
    );
    expect(container.querySelector('.dreamteam-icon')).toBeInTheDocument();
  });

  it('shows no substitute button when showTransferButtons={false}', () => {
    render(
      <PlayerCard
        player={mockPlayer}
        showTransferButtons={false}
        team={[mockPlayer]}
        allPlayers={[mockPlayer]}
        onTransfer={vi.fn()}
      />
    );
    expect(screen.queryByTitle('Substitute')).not.toBeInTheDocument();
  });

  it('calls onPlayerClick with player and teamType when substitute button is clicked', () => {
    const onPlayerClick = vi.fn();
    render(
      <PlayerCard
        player={mockPlayer}
        showTransferButtons={true}
        team={[mockPlayer]}
        allPlayers={[mockPlayer]}
        onTransfer={vi.fn()}
        onPlayerClick={onPlayerClick}
        teamType="active"
      />
    );
    fireEvent.click(screen.getByTitle('Substitute'));
    expect(onPlayerClick).toHaveBeenCalledWith(mockPlayer, 'active');
  });

  it('calls onSetCaptain with player.code when captain button is clicked', () => {
    const onSetCaptain = vi.fn();
    render(
      <PlayerCard
        player={mockPlayer}
        isCaptain={false}
        showTransferButtons={true}
        team={[]}
        allPlayers={[]}
        onTransfer={vi.fn()}
        onSetCaptain={onSetCaptain}
      />
    );
    // MUI Tooltip sets aria-label="Set as Captain" on the wrapped IconButton
    fireEvent.click(screen.getByRole('button', { name: /set as captain/i }));
    expect(onSetCaptain).toHaveBeenCalledWith(mockPlayer.code);
  });

  it('captain action button is NOT rendered (hidden placeholder shown) when onSetCaptain is undefined', () => {
    render(
      <PlayerCard
        player={mockPlayer}
        showTransferButtons={true}
        team={[]}
        allPlayers={[]}
        onTransfer={vi.fn()}
        onSetCaptain={undefined}
      />
    );
    // When onSetCaptain is undefined, isCaptainEligible=false → hidden placeholder, no captain button
    expect(screen.queryByRole('button', { name: /set as captain/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /captain/i })).not.toBeInTheDocument();
  });

  it('predictedPoints of 0 renders as "0" not empty', () => {
    const { container } = render(
      <PlayerCard player={{ ...mockPlayer, predictedPoints: 0 }} />
    );
    expect(container.querySelector('.points-display')).toHaveTextContent('0');
  });

  it('predictedPoints of "7.5" (string) renders as "7.5"', () => {
    const { container } = render(
      <PlayerCard player={{ ...mockPlayer, predictedPoints: '7.5' }} />
    );
    expect(container.querySelector('.points-display')).toHaveTextContent('7.5');
  });
});
