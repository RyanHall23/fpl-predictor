'use strict';

const formatEventMinute = (minute) => minute == null ? null : minute;

const buildFixtureEvents = (fixture) => {
  const eventStats = (fixture.stats ?? []).filter(stat => [
    'goals_scored', 'assists', 'own_goals', 'yellow_cards', 'red_cards',
  ].includes(stat.identifier));

  const events = eventStats.flatMap(stat => {
    const icon = stat.identifier === 'goals_scored' || stat.identifier === 'own_goals'
      ? 'goal'
      : stat.identifier === 'assists' ? 'assist'
        : stat.identifier === 'yellow_cards' ? 'yellow' : 'red';
    return ['h', 'a'].flatMap(side => (stat[side] ?? []).flatMap(entry =>
      Array.from({ length: entry.value || 1 }, () => ({
        icon,
        player: entry.webName,
        teamId: side === 'h' ? fixture.team_h : fixture.team_a,
        ownGoal: stat.identifier === 'own_goals',
        minute: formatEventMinute(entry.minute),
      }))
    ));
  }).sort((left, right) => {
    if (left.minute == null && right.minute == null) return 0;
    if (left.minute == null) return 1;
    if (right.minute == null) return -1;
    return Number(left.minute) - Number(right.minute);
  });

  const displayEvents = [];
  events.forEach(event => {
    if (event.icon === 'assist') {
      const goal = displayEvents.find(item => item.icon === 'goal'
        && item.teamId === event.teamId
        && item.minute === event.minute
        && !item.assist);
      if (goal) {
        goal.assist = event.player;
        return;
      }
    }
    displayEvents.push({ ...event });
  });
  return displayEvents;
};

module.exports = { buildFixtureEvents };
