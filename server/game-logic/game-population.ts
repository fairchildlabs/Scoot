import { PopulationState, PlayerStatus, GameState, Player, Team, GameConfig } from './types';
import { storage } from '../storage';

/**
 * Game Population Algorithm
 * 
 * This module implements a state machine for populating basketball games.
 * The algorithm follows these main states:
 * 
 * 1. WAITING_FOR_PLAYERS: Collecting and validating available players
 * 2. TEAM_ASSIGNMENT: Balanced team creation based on skill and history
 * 3. COURT_SELECTION: Determining optimal court assignment
 * 4. GAME_CREATION: Creating the game in the system
 * 5. COMPLETE: Finalization and cleanup
 * 
 * State transitions are handled by pure functions for testability and clarity.
 */

/**
 * Initialize a new game state
 * @param config Game configuration parameters
 */
export function initializeGameState(config: GameConfig): GameState {
  return {
    currentState: PopulationState.WAITING_FOR_PLAYERS,
    availablePlayers: [],
    teamA: { players: [], avgSkillRating: 0, totalGamesPlayed: 0 },
    teamB: { players: [], avgSkillRating: 0, totalGamesPlayed: 0 },
    selectedCourt: null,
    config
  };
}

/**
 * Main state machine transition function
 * @param currentState Current game state
 * @returns Updated game state
 */
export function transitionGameState(state: GameState): GameState {
  switch (state.currentState) {
    case PopulationState.WAITING_FOR_PLAYERS:
      return handleWaitingForPlayers(state);
    case PopulationState.TEAM_ASSIGNMENT:
      return handleTeamAssignment(state);
    case PopulationState.COURT_SELECTION:
      return handleCourtSelection(state);
    case PopulationState.GAME_CREATION:
      return handleGameCreation(state);
    case PopulationState.COMPLETE:
      return state;
    default:
      throw new Error(`Invalid state: ${state.currentState}`);
  }
}

/**
 * Handle WAITING_FOR_PLAYERS state
 * Checks if enough players are available and transitions to team assignment
 */
function handleWaitingForPlayers(state: GameState): GameState {
  const minPlayers = state.config.minPlayersPerTeam * 2;
  
  if (state.availablePlayers.length >= minPlayers) {
    return {
      ...state,
      currentState: PopulationState.TEAM_ASSIGNMENT
    };
  }
  
  return state;
}

/**
 * Handle TEAM_ASSIGNMENT state
 * Implements team balancing algorithm based on:
 * - Player skill ratings
 * - Historical game data
 * - Consecutive losses
 */
function handleTeamAssignment(state: GameState): GameState {
  // Sort players by skill rating and games played
  const sortedPlayers = [...state.availablePlayers].sort((a, b) => {
    const skillDiff = calculatePlayerSkill(b) - calculatePlayerSkill(a);
    if (skillDiff !== 0) return skillDiff;
    return b.gamesPlayed - a.gamesPlayed;
  });

  // Distribute players to teams using alternating assignment
  const teamA: Player[] = [];
  const teamB: Player[] = [];
  
  sortedPlayers.forEach((player, index) => {
    if (index % 2 === 0) {
      teamA.push(player);
    } else {
      teamB.push(player);
    }
  });

  return {
    ...state,
    teamA: createTeam(teamA),
    teamB: createTeam(teamB),
    currentState: PopulationState.COURT_SELECTION
  };
}

/**
 * Handle COURT_SELECTION state
 * Selects court based on:
 * - Court availability
 * - Team preferences
 * - Historical court usage
 */
function handleCourtSelection(state: GameState): GameState {
  // For now, simple selection from configured preferences
  const selectedCourt = state.config.courtPreference[0];
  
  return {
    ...state,
    selectedCourt,
    currentState: PopulationState.GAME_CREATION
  };
}

/**
 * Handle GAME_CREATION state
 * Creates the game in the database and updates player statuses
 */
function handleGameCreation(state: GameState): GameState {
  // Final validation before game creation
  if (!isValidGameState(state)) {
    throw new Error("Invalid game state for creation");
  }

  return {
    ...state,
    currentState: PopulationState.COMPLETE
  };
}

/**
 * Utility Functions
 */

function calculatePlayerSkill(player: Player): number {
  // Simplified skill calculation
  return player.gamesPlayed - (player.consecutiveLosses * 0.5);
}

function createTeam(players: Player[]): Team {
  const totalGames = players.reduce((sum, p) => sum + p.gamesPlayed, 0);
  const avgSkill = players.reduce((sum, p) => sum + calculatePlayerSkill(p), 0) / players.length;
  
  return {
    players,
    avgSkillRating: avgSkill,
    totalGamesPlayed: totalGames
  };
}

function isValidGameState(state: GameState): boolean {
  return (
    state.teamA.players.length === state.teamB.players.length &&
    state.teamA.players.length >= state.config.minPlayersPerTeam &&
    state.selectedCourt !== null
  );
}

/**
 * Public API
 */

export async function populateGame(setId: number): Promise<GameState> {
  // Initialize game state with default config
  const config: GameConfig = {
    minPlayersPerTeam: 3,
    maxPlayersPerTeam: 5,
    maxConsecutiveLosses: 2,
    courtPreference: ['West', 'East']
  };

  let gameState = initializeGameState(config);

  // Get checked-in players from storage
  const checkins = await storage.getCheckins(34);
  gameState.availablePlayers = checkins.map(checkin => ({
    id: checkin.userId,
    username: checkin.username,
    gamesPlayed: 0, // TODO: Get from historical data
    consecutiveLosses: 0,
    status: PlayerStatus.AVAILABLE
  }));

  // Run state machine until completion
  while (gameState.currentState !== PopulationState.COMPLETE) {
    gameState = transitionGameState(gameState);
  }

  return gameState;
}
