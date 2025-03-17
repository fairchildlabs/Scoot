import { users, type User, type InsertUser, checkins, type Checkin, type Game, games, type GamePlayer, gamePlayers, type GameSet, gameSets, type InsertGameSet } from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { GameState } from "./game-logic/types";

const scryptAsync = promisify(scrypt);

// Move hashPassword function outside the block scope
const initHashPassword = async (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
};

const PostgresSessionStore = connectPg(session);

function getCentralTime() {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
}

function getDateString(date: Date) {
  return date.toISOString().split('T')[0];
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  getCheckins(clubIndex: number): Promise<(Checkin & { username: string })[]>;
  createCheckin(userId: number, clubIndex: number): Promise<Checkin>;
  deactivateCheckin(checkinId: number): Promise<void>;
  createGame(setId: number, court: string, state: string): Promise<Game>;
  updateGameScore(gameId: number, team1Score: number, team2Score: number): Promise<Game>;
  getAllUsers(): Promise<User[]>;
  sessionStore: session.Store;
  createGameSet(userId: number, gameSet: InsertGameSet): Promise<GameSet>;
  getActiveGameSet(): Promise<GameSet | undefined>;
  getAllGameSets(): Promise<GameSet[]>;
  deactivateGameSet(setId: number): Promise<void>;
  createGamePlayer(gameId: number, userId: number, team: number): Promise<GamePlayer>;
  getGame(gameId: number): Promise<Game & { players: (GamePlayer & { username: string, birthYear?: number, queuePosition: number })[] }>;
  getGameSetLog(gameSetId: number): Promise<any[]>;
  determinePromotionType(gameId: number): Promise<{ type: 'win_promoted' | 'loss_promoted', team: 1 | 2 } | null>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.username}) = LOWER(${username})`);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getCheckins(clubIndex: number): Promise<(Checkin & { username: string })[]> {
    const today = getDateString(getCentralTime());

    // Get active game set first to get current_queue_position
    const [activeGameSet] = await db
      .select()
      .from(gameSets)
      .where(eq(gameSets.isActive, true));

    if (!activeGameSet) {
      console.log('getCheckins - No active game set, returning empty list');
      return [];
    }

    console.log('getCheckins - Active game set:', {
      id: activeGameSet.id,
      currentQueuePosition: activeGameSet.currentQueuePosition
    });

    // Get all active checkins for today
    const results = await db
      .select({
        id: checkins.id,
        userId: checkins.userId,
        checkInTime: checkins.checkInTime,
        isActive: checkins.isActive,
        clubIndex: checkins.clubIndex,
        checkInDate: checkins.checkInDate,
        queuePosition: checkins.queuePosition,
        username: users.username,
        birthYear: users.birthYear,
        gameSetId: checkins.gameSetId,
        type: checkins.type,
        gameId: checkins.gameId
      })
      .from(checkins)
      .innerJoin(users, eq(checkins.userId, users.id))
      .where(
        and(
          eq(checkins.clubIndex, clubIndex),
          eq(checkins.isActive, true),
          eq(checkins.checkInDate, today)
        )
      )
      .orderBy(checkins.queuePosition);

    console.log('getCheckins - Found checkins:',
      results.map(r => ({
        username: r.username,
        pos: r.queuePosition,
        type: r.type,
        isActive: r.isActive,
        gameId: r.gameId
      }))
    );

    return results;
  }

  async deactivateCheckin(checkinId: number): Promise<void> {
    console.log(`Deactivating checkin ${checkinId}`);
    await db
      .update(checkins)
      .set({ isActive: false })
      .where(eq(checkins.id, checkinId));
    console.log(`Successfully deactivated checkin ${checkinId}`);
  }

  async createGame(setId: number, court: string, state: string): Promise<Game> {
    // Get the game set first to access players_per_team
    const [gameSet] = await db.select().from(gameSets).where(eq(gameSets.id, setId));
    if (!gameSet) throw new Error(`Game set ${setId} not found`);

    // Increment current queue position by players_per_team * 2 (for both teams)
    const newQueuePosition = gameSet.currentQueuePosition + (gameSet.playersPerTeam * 2);
    console.log(`Updating game set ${setId} current_queue_position from ${gameSet.currentQueuePosition} to ${newQueuePosition}`);

    await db
      .update(gameSets)
      .set({
        currentQueuePosition: newQueuePosition
      })
      .where(eq(gameSets.id, setId));

    // Create the game
    const [game] = await db
      .insert(games)
      .values({
        setId,
        startTime: new Date(),
        clubIndex: 34,
        court,
        state
      })
      .returning();
    return game;
  }

  async updateGameScore(gameId: number, team1Score: number, team2Score: number): Promise<Game> {
    console.log(`PATCH /api/games/${gameId}/score - Processing score update:`, { team1Score, team2Score });

    // Get the game and game set
    const [game] = await db.select().from(games).where(eq(games.id, gameId));
    if (!game) throw new Error(`Game ${gameId} not found`);

    const [gameSet] = await db.select().from(gameSets).where(eq(gameSets.id, game.setId));
    if (!gameSet) throw new Error(`Game set ${game.setId} not found`);

    // Log all active checkins before update
    const activeCheckins = await db
      .select({
        id: checkins.id,
        userId: checkins.userId,
        username: users.username,
        isActive: checkins.isActive
      })
      .from(checkins)
      .innerJoin(users, eq(checkins.userId, users.id))
      .where(eq(checkins.gameId, gameId));

    console.log(`Found ${activeCheckins.length} checkins for game ${gameId} before deactivation:`,
      activeCheckins.map(c => `${c.username} (Active: ${c.isActive})`));

    // Deactivate ALL checkins for this game directly
    await db
      .update(checkins)
      .set({ isActive: false })
      .where(eq(checkins.gameId, gameId));

    // Update game scores and status
    const [updatedGame] = await db
      .update(games)
      .set({
        team1Score,
        team2Score,
        endTime: new Date(),
        state: 'final'
      })
      .where(eq(games.id, gameId))
      .returning();

    // Determine promotion type and team
    const promotionInfo = await this.determinePromotionType(gameId);
    if (promotionInfo) {
      console.log('Promotion determined:', promotionInfo);

      // Get all players from the game with their user info including autoup setting
      const players = await db
        .select({
          userId: gamePlayers.userId,
          team: gamePlayers.team,
          autoup: users.autoup,
          username: users.username
        })
        .from(gamePlayers)
        .innerJoin(users, eq(gamePlayers.userId, users.id))
        .where(eq(gamePlayers.gameId, gameId));

      // Separate players into promoted and non-promoted teams
      const promotedTeamPlayers = players.filter(p => p.team === promotionInfo.team);
      const nonPromotedTeamPlayers = players.filter(p => p.team !== promotionInfo.team);

      console.log('Players by promotion status:', {
        promoted: promotedTeamPlayers.map(p => `${p.username} (Team ${p.team})`),
        nonPromoted: nonPromotedTeamPlayers.map(p => `${p.username} (Team ${p.team})`)
      });

      // First, update the queue_next_up pointer for all shifted positions
      const updatedQueueNextUp = gameSet.queueNextUp + gameSet.playersPerTeam;
      await db
        .update(gameSets)
        .set({
          queueNextUp: updatedQueueNextUp
        })
        .where(eq(gameSets.id, gameSet.id));

      // Then increment queue positions for all checkins >= current_queue_position
      await db
        .update(checkins)
        .set({
          queuePosition: sql`${checkins.queuePosition} + ${gameSet.playersPerTeam}`
        })
        .where(
          and(
            eq(checkins.checkInDate, getDateString(getCentralTime())),
            eq(checkins.isActive, true),
            sql`${checkins.queuePosition} >= ${gameSet.currentQueuePosition}`
          )
        );

      // Create new checkins for promoted team players - keeping their team position
      for (let i = 0; i < promotedTeamPlayers.length; i++) {
        const player = promotedTeamPlayers[i];
        console.log(`Creating promoted checkin for ${player.username} (maintaining Team ${player.team} position)`);
        await db
          .insert(checkins)
          .values({
            userId: player.userId,
            clubIndex: 34,
            checkInTime: getCentralTime(),
            isActive: true,
            checkInDate: getDateString(getCentralTime()),
            gameSetId: gameSet.id,
            queuePosition: gameSet.currentQueuePosition + i,
            type: promotionInfo.type,
            gameId: null
          });
      }

      // Handle non-promoted team players - auto check-in based on autoup setting
      let nextPosition = updatedQueueNextUp;  // Start from the updated queue_next_up position
      for (const player of nonPromotedTeamPlayers) {
        if (player.autoup) {
          console.log(`Auto-checking in player ${player.username} (Team ${player.team}) at position ${nextPosition}`);
          await db
            .insert(checkins)
            .values({
              userId: player.userId,
              clubIndex: 34,
              checkInTime: getCentralTime(),
              isActive: true,
              checkInDate: getDateString(getCentralTime()),
              gameSetId: gameSet.id,
              queuePosition: nextPosition,
              type: 'autoup',
              gameId: null
            });
          nextPosition++;
        } else {
          console.log(`Player ${player.username} has autoup disabled, not auto-checking in`);
        }
      }

      // Finally, update game set's queue next up pointer to the next available position
      await db
        .update(gameSets)
        .set({
          queueNextUp: nextPosition
        })
        .where(eq(gameSets.id, gameSet.id));
    }

    return updatedGame;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async createGameSet(userId: number, gameSet: InsertGameSet): Promise<GameSet> {
    // First deactivate all existing game sets
    await db
      .update(gameSets)
      .set({ isActive: false })
      .where(eq(gameSets.isActive, true));


    const [newGameSet] = await db
      .insert(gameSets)
      .values({
        ...gameSet,
        createdBy: userId,
        currentQueuePosition: 1, // Head pointer - set to 1 at creation
        queueNextUp: 1, // Tail pointer - starts at 1
      })
      .returning();

    return newGameSet;
  }

  async getActiveGameSet(): Promise<GameSet | undefined> {
    const [gameSet] = await db
      .select()
      .from(gameSets)
      .where(eq(gameSets.isActive, true));
    return gameSet;
  }

  async getAllGameSets(): Promise<GameSet[]> {
    return await db
      .select()
      .from(gameSets)
      .orderBy(desc(gameSets.createdAt));
  }

  async deactivateGameSet(setId: number): Promise<void> {
    await db
      .update(gameSets)
      .set({ isActive: false })
      .where(eq(gameSets.id, setId));
  }

  async createGamePlayer(gameId: number, userId: number, team: number): Promise<GamePlayer> {
    console.log(`Creating game player for user ${userId} in game ${gameId} on team ${team}`);

    // First get the most recent checkin with promotion status
    const [promotedCheckin] = await db
      .select({
        type: checkins.type,
        gameId: checkins.gameId,
        username: users.username,
        queuePosition: checkins.queuePosition
      })
      .from(checkins)
      .innerJoin(users, eq(checkins.userId, users.id))
      .where(
        and(
          eq(checkins.userId, userId),
          sql`${checkins.type} IN ('win_promoted', 'loss_promoted')`
        )
      )
      .orderBy(desc(checkins.id))  // Order by checkin ID to get most recent
      .limit(1);

    console.log('Found promotion status:', promotedCheckin ? {
      username: promotedCheckin.username,
      type: promotedCheckin.type,
      gameId: promotedCheckin.gameId,
      queuePosition: promotedCheckin.queuePosition
    } : 'No promotion found');

    // If player was promoted, get their team from that game
    if (promotedCheckin?.gameId) {
      const [previousGame] = await db
        .select({
          team: gamePlayers.team,
          gameId: gamePlayers.gameId
        })
        .from(gamePlayers)
        .where(
          and(
            eq(gamePlayers.gameId, promotedCheckin.gameId),
            eq(gamePlayers.userId, userId)
          )
        );

      console.log('Previous game found:', previousGame ? {
        username: promotedCheckin.username,
        previousTeam: previousGame.team,
        previousGameId: previousGame.gameId,
        assignedTeam: previousGame ? previousGame.team : team
      } : 'No previous game found');

      if (previousGame) {
        team = previousGame.team; // Keep same team assignment (1=Home, 2=Away)
        console.log(`Promoted player ${promotedCheckin.username} maintaining previous team position: ${team === 1 ? 'Home' : 'Away'} (Team ${team})`);
      }
    }

    // Create game player entry
    const [gamePlayer] = await db
      .insert(gamePlayers)
      .values({
        gameId,
        userId,
        team
      })
      .returning();

    // Update the player's current active checkin with the game ID
    const [currentCheckin] = await db
      .select()
      .from(checkins)
      .where(
        and(
          eq(checkins.userId, userId),
          eq(checkins.isActive, true)
        )
      );

    if (currentCheckin) {
      console.log(`Updating checkin ${currentCheckin.id} with gameId ${gameId}`);
      await db
        .update(checkins)
        .set({
          gameId // Link this checkin to the game
        })
        .where(eq(checkins.id, currentCheckin.id));
    } else {
      console.error(`No active checkin found for user ${userId}`);
    }

    return gamePlayer;
  }

  async getGame(gameId: number): Promise<Game & { players: (GamePlayer & { username: string, birthYear?: number, queuePosition: number })[] }> {
    // Get the game
    const [game] = await db.select().from(games).where(eq(games.id, gameId));
    if (!game) throw new Error(`Game ${gameId} not found`);

    // Get all players in this game with their user information and queue positions
    const players = await db
      .select({
        id: gamePlayers.id,
        gameId: gamePlayers.gameId,
        userId: gamePlayers.userId,
        team: gamePlayers.team,
        username: users.username,
        birthYear: users.birthYear,
        queuePosition: checkins.queuePosition
      })
      .from(gamePlayers)
      .innerJoin(users, eq(gamePlayers.userId, users.id))
      .leftJoin(checkins, and(
        eq(checkins.userId, gamePlayers.userId),
        eq(checkins.gameId, gameId)  // Join with checkins for this game
      ))
      .where(eq(gamePlayers.gameId, gameId))
      .orderBy(gamePlayers.team, gamePlayers.userId); // Order by team first, then by userId for consistent ordering

    return {
      ...game,
      players: players.map(player => ({
        ...player,
        queuePosition: player.queuePosition || 0 // Ensure queuePosition is never null
      }))
    };
  }

  async determinePromotionType(gameId: number): Promise<{ type: 'win_promoted' | 'loss_promoted', team: 1 | 2 } | null> {
    // Get the completed game with its game set info
    const [game] = await db
      .select({
        id: games.id,
        setId: games.setId,
        court: games.court,
        team1Score: games.team1Score,
        team2Score: games.team2Score,
        maxConsecutiveTeamWins: gameSets.maxConsecutiveTeamWins
      })
      .from(games)
      .innerJoin(gameSets, eq(games.setId, gameSets.id))
      .where(eq(games.id, gameId));

    if (!game) throw new Error(`Game ${gameId} not found`);

    // Get previous games on this court in this set
    const previousGames = await db
      .select()
      .from(games)
      .where(
        and(
          eq(games.setId, game.setId),
          eq(games.court, game.court),
          eq(games.state, 'final'),
          sql`${games.id} < ${gameId}`  // Only get games before this one
        )
      )
      .orderBy(desc(games.id));  // Most recent first

    // Determine winning team of current game
    const winningTeam = game.team1Score! > game.team2Score! ? 1 : 2;

    // Count consecutive wins for the winning team
    let consecutiveWins = 1;  // Start with 1 for current game
    for (const prevGame of previousGames) {
      const prevWinner = prevGame.team1Score! > prevGame.team2Score! ? 1 : 2;
      if (prevWinner === winningTeam) {
        consecutiveWins++;
      } else {
        break;  // Chain broken
      }
    }

    console.log('Promotion check:', {
      gameId,
      court: game.court,
      winningTeam,
      consecutiveWins,
      maxAllowed: game.maxConsecutiveTeamWins
    });

    // If team hasn't exceeded max consecutive wins, they get promoted
    if (consecutiveWins < game.maxConsecutiveTeamWins) {
      return { type: 'win_promoted', team: winningTeam };
    }

    // If team has reached max consecutive wins, losing team gets promoted
    return { type: 'loss_promoted', team: winningTeam === 1 ? 2 : 1 };
  }

  async getGameSetLog(gameSetId: number): Promise<any[]> {
    // Get all checkins for this game set with user info
    const checkinsWithUsers = await db
      .select({
        queuePosition: checkins.queuePosition,
        userId: checkins.userId,
        username: users.username,
        checkInTime: checkins.checkInTime,
        gameId: checkins.gameId,
        type: checkins.type
      })
      .from(checkins)
      .innerJoin(users, eq(checkins.userId, users.id))
      .where(eq(checkins.gameSetId, gameSetId))
      .orderBy(checkins.queuePosition);

    // Get all games for this set with player info
    const gamesWithPlayers = await db
      .select({
        id: games.id,
        court: games.court,
        state: games.state,
        team1Score: games.team1Score,
        team2Score: games.team2Score,
        startTime: games.startTime,
        endTime: games.endTime,
      })
      .from(games)
      .where(eq(games.setId, gameSetId));

    // Get player assignments for each game
    const gamePlayerAssignments = await Promise.all(
      gamesWithPlayers.map(async (game) => {
        const players = await db
          .select({
            gameId: gamePlayers.gameId,
            userId: gamePlayers.userId,
            team: gamePlayers.team,
          })
          .from(gamePlayers)
          .where(eq(gamePlayers.gameId, game.id));
        return { ...game, players };
      })
    );

    // Combine checkins with game information
    return checkinsWithUsers.map((checkin) => {
      // Find game where this user played
      const gameInfo = gamePlayerAssignments.find((game) =>
        game.players.some((p) => p.userId === checkin.userId)
      );

      if (!gameInfo) {
        return {
          ...checkin,
          gameStatus: "Pending",
          team: null,
          score: null,
          court: null,
          type: checkin.type
        };
      }

      const playerInfo = gameInfo.players.find((p) => p.userId === checkin.userId);
      const team = playerInfo?.team === 1 ? "Home" : "Away";
      const score =
        gameInfo.state === "final"
          ? `${gameInfo.team1Score}-${gameInfo.team2Score}`
          : "In Progress";

      return {
        ...checkin,
        gameStatus: gameInfo.state,
        team,
        score,
        court: gameInfo.court,
        type: checkin.type
      };
    });
  }

  async createCheckin(userId: number, clubIndex: number): Promise<Checkin> {
    const now = getCentralTime();
    const today = getDateString(now);

    console.log(`Attempting to create checkin for user ${userId} at club ${clubIndex}`);

    // Get active game set first
    const activeGameSet = await this.getActiveGameSet();
    if (!activeGameSet) {
      throw new Error("No active game set available for check-ins");
    }

    // Check for existing active checkin for this user
    const existingCheckins = await db
      .select()
      .from(checkins)
      .where(
        and(
          eq(checkins.userId, userId),
          eq(checkins.clubIndex, clubIndex),
          eq(checkins.isActive, true),
          eq(checkins.checkInDate, today)
        )
      );

    // If user already has an active checkin, return it
    if (existingCheckins.length > 0) {
      console.log(`User ${userId} already has an active checkin for today:`, existingCheckins[0]);
      return existingCheckins[0];
    }

    // Create new checkin with next queue position
    console.log(`Creating new checkin for user ${userId}`);
    const [checkin] = await db
      .insert(checkins)
      .values({
        userId,
        clubIndex,
        checkInTime: now,
        isActive: true,
        checkInDate: today,
        gameSetId: activeGameSet.id,
        queuePosition: activeGameSet.queueNextUp,
        type: 'manual',
        gameId: null // Ensure gameId starts as null
      })
      .returning();

    // Increment the game set's queueNextUp (tail pointer)
    await db
      .update(gameSets)
      .set({
        queueNextUp: activeGameSet.queueNextUp + 1
      })
      .where(eq(gameSets.id, activeGameSet.id));

    console.log(`Created new checkin:`, checkin);
    return checkin;
  }
}

export const storage = new DatabaseStorage();

// Make admin initialization asynchronous
if (process.env.ADMIN_INITIAL_PASSWORD) {
  // Defer admin initialization to next tick to prevent blocking startup
  process.nextTick(async () => {
    console.log('Starting admin initialization...');
    const hashedPassword = await initHashPassword(process.env.ADMIN_INITIAL_PASSWORD);
    const existingAdmin = await storage.getUserByUsername("scuzzydude");
    if (!existingAdmin) {
      await storage.createUser({
        username: "scuzzydude",
        password: hashedPassword,
        firstName: null,
        lastName: null,
        birthYear: 1900,
        birthMonth: undefined,
        birthDay: undefined,
        isPlayer: true,
        isBank: true,
        isBook: true,
        isEngineer: true,
        isRoot: true,
      });
      console.log('Admin initialization completed');
    } else {
      console.log('Admin user already exists');
    }
  });
}