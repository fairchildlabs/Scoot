import { 
  PopulationState, 
  PlayerStatus, 
  GameState, 
  Player, 
  Team, 
  GameConfig,
  MoveType,
  MoveResult 
} from './types';
import { storage } from '../storage';

// Current year constant for OG calculation
const CURRENT_YEAR = new Date().getFullYear();
const OG_AGE_THRESHOLD = 75;

/**
 * Check if a player is an OG based on birth year
 */
function isOGPlayer(birthYear: number | undefined): boolean {
  if (!birthYear) return false;
  return (CURRENT_YEAR - birthYear) >= OG_AGE_THRESHOLD;
}

/**
 * Initialize a new game state
 */
export function initializeGameState(config: GameConfig): GameState {
  return {
    currentState: PopulationState.WAITING_FOR_PLAYERS,
    availablePlayers: [],
    teamA: { players: [], avgSkillRating: 0, totalGamesPlayed: 0, ogCount: 0 },
    teamB: { players: [], avgSkillRating: 0, totalGamesPlayed: 0, ogCount: 0 },
    selectedCourt: null,
    config
  };
}

/**
 * Move a player according to the specified move type
 */
export function movePlayer(state: GameState, playerId: number, moveType: MoveType): MoveResult {
  const playerIndex = findPlayerIndex(state, playerId);
  if (playerIndex === -1) {
    return {
      success: false,
      message: "Player not found",
      updatedState: state
    };
  }

  let newState = JSON.parse(JSON.stringify(state)); // Deep clone to avoid mutations

  switch (moveType) {
    case MoveType.CHECKOUT:
      return handleCheckout(newState, playerIndex);
    case MoveType.BUMP:
      return handleBump(newState, playerIndex);
    case MoveType.HORIZONTAL_SWAP:
      return handleHorizontalSwap(newState, playerIndex);
    case MoveType.VERTICAL_SWAP:
      return handleVerticalSwap(newState, playerIndex);
    default:
      return {
        success: false,
        message: "Invalid move type",
        updatedState: state
      };
  }
}

/**
 * Find which list and position a player is in
 * Returns: { list: 'teamA'|'teamB'|'available', index: number }
 */
function findPlayerIndex(state: GameState, playerId: number): number {
  const inTeamA = state.teamA.players.findIndex(p => p.id === playerId);
  if (inTeamA !== -1) return inTeamA;

  const inTeamB = state.teamB.players.findIndex(p => p.id === playerId);
  if (inTeamB !== -1) return inTeamB + state.teamA.players.length;

  const inAvailable = state.availablePlayers.findIndex(p => p.id === playerId);
  if (inAvailable !== -1) return inAvailable + state.teamA.players.length + state.teamB.players.length;

  return -1;
}

/**
 * Handle player checkout and replacement
 */
function handleCheckout(state: GameState, playerIndex: number): MoveResult {
  const newState = { ...state };
  const teamSize = state.config.maxPlayersPerTeam;

  console.log('Checkout - Starting with:', {
    playerIndex,
    teamSize,
    availablePlayers: state.availablePlayers.map(p => p.username)
  });

  // For Next Up players (in availablePlayers)
  if (playerIndex >= teamSize * 2) {
    const availableIndex = playerIndex - (teamSize * 2);

    console.log('Checking out Next Up player:', {
      availableIndex,
      playerName: state.availablePlayers[availableIndex]?.username
    });

    // Remove the player from availablePlayers
    newState.availablePlayers = [
      ...state.availablePlayers.slice(0, availableIndex),
      ...state.availablePlayers.slice(availableIndex + 1)
    ];

    return {
      success: true,
      updatedState: newState
    };
  }

  // For team players
  const nextPlayer = state.availablePlayers[0];
  if (!nextPlayer) {
    return {
      success: false,
      message: "No available players for replacement",
      updatedState: state
    };
  }

  if (playerIndex < teamSize) {
    // Replace in Team A
    newState.teamA.players[playerIndex] = nextPlayer;
    newState.teamA.ogCount = countOGPlayers(newState.teamA.players);
  } else {
    // Replace in Team B
    const teamBIndex = playerIndex - teamSize;
    newState.teamB.players[teamBIndex] = nextPlayer;
    newState.teamB.ogCount = countOGPlayers(newState.teamB.players);
  }

  // Remove the replacement player from availablePlayers
  newState.availablePlayers = state.availablePlayers.slice(1);

  console.log('Checkout - Result:', {
    teamA: newState.teamA.players.map((p, i) => `${i+1}:${p.username}`),
    teamB: newState.teamB.players.map((p, i) => `${i+5}:${p.username}`),
    availablePlayers: newState.availablePlayers.map(p => p.username)
  });

  return {
    success: true,
    updatedState: newState
  };
}

/**
 * Handle bumping a player with the next in queue
 */
function handleBump(state: GameState, playerIndex: number): MoveResult {
  const newState = { ...state };
  const teamSize = state.config.maxPlayersPerTeam;

  // If player is in Next Up list
  if (playerIndex >= teamSize * 2) {
    const availableIndex = playerIndex - (teamSize * 2);
    if (availableIndex >= state.availablePlayers.length - 1) {
      return {
        success: false,
        message: "No player below to bump with",
        updatedState: state
      };
    }

    // Swap with next player in queue
    const temp = newState.availablePlayers[availableIndex];
    newState.availablePlayers[availableIndex] = newState.availablePlayers[availableIndex + 1];
    newState.availablePlayers[availableIndex + 1] = temp;
  } else {
    // Player is in a team, swap with first available
    if (state.availablePlayers.length === 0) {
      return {
        success: false,
        message: "No available players to bump with",
        updatedState: state
      };
    }

    const bumpPlayer = newState.availablePlayers[0];
    newState.availablePlayers = newState.availablePlayers.slice(1);

    if (playerIndex < teamSize) {
      const temp = newState.teamA.players[playerIndex];
      newState.teamA.players[playerIndex] = bumpPlayer;
      newState.availablePlayers.unshift(temp);
      newState.teamA.ogCount = countOGPlayers(newState.teamA.players);
    } else {
      const temp = newState.teamB.players[playerIndex - teamSize];
      newState.teamB.players[playerIndex - teamSize] = bumpPlayer;
      newState.availablePlayers.unshift(temp);
      newState.teamB.ogCount = countOGPlayers(newState.teamB.players);
    }
  }

  return {
    success: true,
    updatedState: newState
  };
}

/**
 * Handle horizontal swap between teams
 */
function handleHorizontalSwap(state: GameState, playerIndex: number): MoveResult {
  const teamSize = state.config.maxPlayersPerTeam;

  console.log('Horizontal Swap - Starting with:', {
    playerIndex,
    teamSize,
    teamA: state.teamA.players.map((p, i) => `${i+1}:${p.username}`),
    teamB: state.teamB.players.map((p, i) => `${i+5}:${p.username}`)
  });

  // Only allow horizontal swaps for team players
  if (playerIndex >= teamSize * 2) {
    return {
      success: false,
      message: "Cannot swap Next Up players horizontally",
      updatedState: state
    };
  }

  const newState = JSON.parse(JSON.stringify(state)); // Deep clone
  const isTeamA = playerIndex < teamSize;

  if (isTeamA) {
    // Player is in Team A (Home) - swap with same relative position in Team B
    const relativePosition = playerIndex;
    console.log('Home team swap:', {
      homePlayerIndex: playerIndex,
      homePlayerName: state.teamA.players[relativePosition].username,
      awayPlayerName: state.teamB.players[relativePosition].username
    });

    // Simple swap at the same relative position
    const temp = newState.teamA.players[relativePosition];
    newState.teamA.players[relativePosition] = newState.teamB.players[relativePosition];
    newState.teamB.players[relativePosition] = temp;
  } else {
    // Player is in Team B (Away) - swap with same relative position in Team A
    const relativePosition = playerIndex - teamSize;
    console.log('Away team swap:', {
      awayPlayerIndex: playerIndex,
      awayPlayerName: state.teamB.players[relativePosition].username,
      homePlayerName: state.teamA.players[relativePosition].username
    });

    // Simple swap at the same relative position
    const temp = newState.teamB.players[relativePosition];
    newState.teamB.players[relativePosition] = newState.teamA.players[relativePosition];
    newState.teamA.players[relativePosition] = temp;
  }

  // Update OG counts
  newState.teamA.ogCount = countOGPlayers(newState.teamA.players);
  newState.teamB.ogCount = countOGPlayers(newState.teamB.players);

  console.log('Horizontal Swap - Result:', {
    teamA: newState.teamA.players.map((p, i) => `${i+1}:${p.username}`),
    teamB: newState.teamB.players.map((p, i) => `${i+5}:${p.username}`)
  });

  return {
    success: true,
    updatedState: newState
  };
}

/**
 * Handle vertical swap within team B only
 */
function handleVerticalSwap(state: GameState, playerIndex: number): MoveResult {
  const teamSize = state.config.maxPlayersPerTeam;

  console.log('Vertical Swap - Starting with:', {
    playerIndex,
    teamSize,
    teamB: state.teamB.players.map((p, i) => `${i+5}:${p.username}`)
  });

  // Only allow vertical swaps for Team B players
  if (playerIndex < teamSize || playerIndex >= teamSize * 2) {
    return {
      success: false,
      message: "Can only swap Team B (Away) players vertically",
      updatedState: state
    };
  }

  const newState = JSON.parse(JSON.stringify(state));
  const currentIndex = playerIndex - teamSize; // Position within Team B (0-4)

  // For last player (#8), wrap to first Away position (#5)
  // Otherwise move to next position
  const nextIndex = currentIndex === teamSize - 1 ? 0 : currentIndex + 1;

  console.log('Vertical Swap - Calculated positions:', {
    currentPlayer: `${currentIndex+5}:${state.teamB.players[currentIndex].username}`,
    nextPlayer: `${nextIndex+5}:${state.teamB.players[nextIndex].username}`,
    currentIndex,
    nextIndex
  });

  // Perform the swap within Team B
  const temp = newState.teamB.players[currentIndex];
  newState.teamB.players[currentIndex] = newState.teamB.players[nextIndex];
  newState.teamB.players[nextIndex] = temp;

  // Update Team B OG count
  newState.teamB.ogCount = countOGPlayers(newState.teamB.players);

  console.log('Vertical Swap - Result:', {
    teamB: newState.teamB.players.map((p, i) => `${i+5}:${p.username}`)
  });

  return {
    success: true,
    updatedState: newState
  };
}

/**
 * Count OG players in a team
 */
function countOGPlayers(players: Player[]): number {
  return players.filter(p => isOGPlayer(p.birthYear)).length;
}

/**
 * Main state machine transition function
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
    totalGamesPlayed: totalGames,
    ogCount: countOGPlayers(players)
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

  // Get checked-in players from storage and mark OGs
  const checkins = await storage.getCheckins(34);
  const teamSize = config.maxPlayersPerTeam;

  // Map checked-in players to their positions
  gameState.teamA.players = checkins.slice(0, teamSize).map(checkin => ({
    id: checkin.userId,
    username: checkin.username,
    gamesPlayed: 0,
    consecutiveLosses: 0,
    birthYear: checkin.birthYear,
    isOG: isOGPlayer(checkin.birthYear),
    status: PlayerStatus.ASSIGNED
  }));

  gameState.teamB.players = checkins.slice(teamSize, teamSize * 2).map(checkin => ({
    id: checkin.userId,
    username: checkin.username,
    gamesPlayed: 0,
    consecutiveLosses: 0,
    birthYear: checkin.birthYear,
    isOG: isOGPlayer(checkin.birthYear),
    status: PlayerStatus.ASSIGNED
  }));

  gameState.availablePlayers = checkins.slice(teamSize * 2).map(checkin => ({
    id: checkin.userId,
    username: checkin.username,
    gamesPlayed: 0,
    consecutiveLosses: 0,
    birthYear: checkin.birthYear,
    isOG: isOGPlayer(checkin.birthYear),
    status: PlayerStatus.AVAILABLE
  }));

  // Update team statistics
  gameState.teamA.ogCount = countOGPlayers(gameState.teamA.players);
  gameState.teamB.ogCount = countOGPlayers(gameState.teamB.players);

  gameState.currentState = PopulationState.COMPLETE;
  return gameState;
}