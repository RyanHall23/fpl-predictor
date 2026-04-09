import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import TeamFormation from './TeamFormation';

vi.mock('../PlayerCard/PlayerCard', () => ({
  default: ({ player }) => (
    <div data-testid="player-card">{player.webName}</div>
  ),
}));

let _id = 0;
const makePlayer = (overrides) => ({
  code: ++_id,
  webName: 'Player',
  position: 3,
  teamCode: 1,
  team: 1,
  predictedPoints: 5,
  opponentDisplay: 'MCI (H)',
  is_captain: false,
  ...overrides,
});

// Standard 11+4 squad for reuse
const gk = makePlayer({ position: 1, webName: 'GK_Active' });
const defs = [
  makePlayer({ position: 2, webName: 'DEF1' }),
  makePlayer({ position: 2, webName: 'DEF2' }),
  makePlayer({ position: 2, webName: 'DEF3' }),
  makePlayer({ position: 2, webName: 'DEF4' }),
];
const mids = [
  makePlayer({ position: 3, webName: 'MID1' }),
  makePlayer({ position: 3, webName: 'MID2' }),
  makePlayer({ position: 3, webName: 'MID3' }),
  makePlayer({ position: 3, webName: 'MID4' }),
];
const atts = [
  makePlayer({ position: 4, webName: 'ATT1' }),
  makePlayer({ position: 4, webName: 'ATT2' }),
];
const activePlayers = [gk, ...defs, ...mids, ...atts]; // 11

const benchGK = makePlayer({ position: 1, webName: 'GK_Bench' });
const benchOutfield = [
  makePlayer({ position: 3, webName: 'BENCH_MID1' }),
  makePlayer({ position: 4, webName: 'BENCH_ATT1' }),
  makePlayer({ position: 2, webName: 'BENCH_DEF1' }),
];
const reservePlayers = [benchGK, ...benchOutfield]; // 4

describe('TeamFormation', () => {
  it('renders 15 player cards total (11 active + 4 reserve)', () => {
    render(
      <TeamFormation
        activePlayers={activePlayers}
        reservePlayers={reservePlayers}
      />
    );
    expect(screen.getAllByTestId('player-card')).toHaveLength(15);
  });

  it('GK player name appears in the document', () => {
    render(
      <TeamFormation
        activePlayers={activePlayers}
        reservePlayers={reservePlayers}
      />
    );
    expect(screen.getByText('GK_Active')).toBeInTheDocument();
  });

  it('DEF player names appear in the document', () => {
    render(
      <TeamFormation
        activePlayers={activePlayers}
        reservePlayers={reservePlayers}
      />
    );
    defs.forEach((p) => expect(screen.getByText(p.webName)).toBeInTheDocument());
  });

  it('MID player names appear in the document', () => {
    render(
      <TeamFormation
        activePlayers={activePlayers}
        reservePlayers={reservePlayers}
      />
    );
    mids.forEach((p) => expect(screen.getByText(p.webName)).toBeInTheDocument());
  });

  it('ATT player names appear in the document', () => {
    render(
      <TeamFormation
        activePlayers={activePlayers}
        reservePlayers={reservePlayers}
      />
    );
    atts.forEach((p) => expect(screen.getByText(p.webName)).toBeInTheDocument());
  });

  it('reserve players appear in the document', () => {
    render(
      <TeamFormation
        activePlayers={activePlayers}
        reservePlayers={reservePlayers}
      />
    );
    expect(screen.getByText('GK_Bench')).toBeInTheDocument();
    benchOutfield.forEach((p) => expect(screen.getByText(p.webName)).toBeInTheDocument());
  });

  it('captain player card renders when activePlayers contains a player with is_captain: true', () => {
    const captainGK = { ...gk, is_captain: true, webName: 'CaptainGK' };
    const active = [captainGK, ...defs, ...mids, ...atts];
    render(
      <TeamFormation
        activePlayers={active}
        reservePlayers={reservePlayers}
      />
    );
    expect(screen.getByText('CaptainGK')).toBeInTheDocument();
  });

  it('when activePlayers contains a manager (position 5), it renders', () => {
    const manager = makePlayer({ position: 5, webName: 'Manager_Active' });
    const activeWithManager = [manager, gk, ...defs, ...mids, ...atts];
    render(
      <TeamFormation
        activePlayers={activeWithManager}
        reservePlayers={reservePlayers}
      />
    );
    expect(screen.getByText('Manager_Active')).toBeInTheDocument();
  });

  it('when reservePlayers contains a manager (position 5), it renders in the bench', () => {
    const benchManager = makePlayer({ position: 5, webName: 'Manager_Bench' });
    render(
      <TeamFormation
        activePlayers={activePlayers}
        reservePlayers={[benchManager, ...reservePlayers]}
      />
    );
    expect(screen.getByText('Manager_Bench')).toBeInTheDocument();
  });

  it('"GK" label appears in the bench section', () => {
    render(
      <TeamFormation
        activePlayers={activePlayers}
        reservePlayers={reservePlayers}
      />
    );
    // positionLabels[1] = 'GK' is rendered as a Typography label above the bench GK
    expect(screen.getAllByText('GK').length).toBeGreaterThan(0);
  });

  it('when activePlayers is empty array, renders without crashing', () => {
    expect(() =>
      render(
        <TeamFormation
          activePlayers={[]}
          reservePlayers={reservePlayers}
        />
      )
    ).not.toThrow();
  });

  it('when isHighestPredictedTeam={true}, still renders all player cards', () => {
    render(
      <TeamFormation
        activePlayers={activePlayers}
        reservePlayers={reservePlayers}
        isHighestPredictedTeam={true}
      />
    );
    expect(screen.getAllByTestId('player-card')).toHaveLength(15);
  });
});
