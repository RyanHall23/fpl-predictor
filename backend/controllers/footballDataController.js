'use strict';

const dataProvider = require('../models/dataProvider');

const FOOTBALL_DATA_BASE = 'https://api.football-data.org/v4';
const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_API_TOKEN;
const TTL_MATCHES = 60 * 1000;

const requireToken = () => {
  if (!FOOTBALL_DATA_TOKEN) {
    throw new Error('FOOTBALL_DATA_API_TOKEN is not configured');
  }
};

const fetchFootballData = (url, ttlMs) => {
  requireToken();
  return dataProvider.cachedGet(url, ttlMs, { 'X-Auth-Token': FOOTBALL_DATA_TOKEN });
};

const minuteLabel = (goalOrEvent) => {
  const minute = goalOrEvent.minute;
  if (minute == null) return '';
  return goalOrEvent.injuryTime ? `${minute}'+${goalOrEvent.injuryTime}'` : `${minute}'`;
};

const goalEvent = (goal) => ({
  icon: 'goal',
  minute: minuteLabel(goal),
  teamId: goal.team?.id,
  player: goal.scorer?.name ?? '',
  secondPlayer: goal.assist?.name ?? '',
  ownGoal: goal.type === 'OWN_GOAL',
  penaltyKick: goal.type === 'PENALTY',
});

const bookingEvent = (booking) => ({
  icon: booking.card === 'RED_CARD' ? 'red' : 'yellow',
  minute: minuteLabel(booking),
  teamId: booking.team?.id,
  player: booking.player?.name ?? '',
  secondPlayer: '',
  ownGoal: false,
  penaltyKick: false,
});

const parseMatch = (match) => ({
  footballDataId: match.id,
  homeName: match.homeTeam?.name ?? '',
  awayName: match.awayTeam?.name ?? '',
  homeAbbr: match.homeTeam?.tla ?? '',
  awayAbbr: match.awayTeam?.tla ?? '',
  homeScore: match.score?.fullTime?.home ?? match.score?.halfTime?.home ?? 0,
  awayScore: match.score?.fullTime?.away ?? match.score?.halfTime?.away ?? 0,
  homeId: match.homeTeam?.id,
  awayId: match.awayTeam?.id,
  state: match.status === 'FINISHED' ? 'post' : ['IN_PLAY', 'PAUSED'].includes(match.status) ? 'in' : 'pre',
  isLive: ['IN_PLAY', 'PAUSED'].includes(match.status),
  isFinished: match.status === 'FINISHED',
  clock: match.minute != null ? `${match.minute}'` : '',
  statusDetail: match.status ?? '',
  details: [
    ...(match.goals ?? []).map(goalEvent),
    ...(match.bookings ?? []).map(bookingEvent),
  ].sort((left, right) => parseFloat(left.minute || 'Infinity') - parseFloat(right.minute || 'Infinity')),
});

const getScoreboard = async (req, res) => {
  try {
    const { dates } = req.query;
    if (dates !== undefined && !/^\d{8}$/.test(dates)) {
      return res.status(400).json({ error: 'Invalid dates parameter — expected YYYYMMDD' });
    }
    const date = dates ? `${dates.slice(0, 4)}-${dates.slice(4, 6)}-${dates.slice(6)}` : null;
    const params = new URLSearchParams({ competitions: 'PL' });
    if (date) {
      params.set('dateFrom', date);
      params.set('dateTo', date);
    }
    const data = await fetchFootballData(`${FOOTBALL_DATA_BASE}/matches?${params}`, TTL_MATCHES);
    res.json((data.matches ?? []).map(parseMatch));
  } catch (error) {
    console.error('[football-data.org] getScoreboard error:', error.message);
    res.status(error.message.includes('not configured') ? 503 : 502).json({ error: 'Failed to fetch football-data.org matches' });
  }
};

const getSummary = async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.matchId)) {
      return res.status(400).json({ error: 'Invalid football-data.org match ID' });
    }
    const match = await fetchFootballData(`${FOOTBALL_DATA_BASE}/matches/${req.params.matchId}`, TTL_MATCHES);
    const events = [
      ...(match.goals ?? []).map(goalEvent),
      ...(match.bookings ?? []).map(bookingEvent),
    ].sort((left, right) => parseFloat(left.minute || 'Infinity') - parseFloat(right.minute || 'Infinity'));
    res.json({ events });
  } catch (error) {
    console.error('[football-data.org] getSummary error:', error.message);
    res.status(error.message.includes('not configured') ? 503 : 502).json({ error: 'Failed to fetch football-data.org match' });
  }
};

module.exports = { getScoreboard, getSummary, parseMatch, goalEvent, bookingEvent };
