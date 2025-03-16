import { users, type User, type InsertUser, checkins, type Checkin, type Game, games, type GamePlayer, gamePlayers, type GameSet, gameSets, type InsertGameSet } from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { GameState } from "./game-logic/types";

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
  updateCheckins(setId: number, gameState: GameState): Promise<void>;
  createGamePlayer(gameId: number, userId: number, team: number): Promise<GamePlayer>;
  getGame(gameId: number): Promise<Game & { players: (GamePlayer & { username: string, birthYear?: number, queuePosition: number })[] }>;
  getGameSetLog(gameSetId: number): Promise<any[]>;
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
        gameSetId: checkins.gameSetId,
        type: checkins.type
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

    return results;
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
        queuePosition: activeGameSet.queueNextUp, // Use queueNextUp for new check-ins
        type: 'manual'
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

  async deactivateCheckin(checkinId: number): Promise<void> {
    console.log(`Deactivating checkin ${checkinId}`);
    await db
      .update(checkins)
      .set({ isActive: false })
      .where(eq(checkins.id, checkinId));
    console.log(`Successfully deactivated checkin ${checkinId}`);
  }

  async createGame(setId: number, court: string, state: string): Promise<Game> {
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

    // Get the game and associated game set first
    const [game] = await db.select().from(games).where(eq(games.id, gameId));
    if (!game) throw new Error(`Game ${gameId} not found`);

    const [gameSet] = await db.select().from(gameSets).where(eq(gameSets.id, game.setId));
    if (!gameSet) throw new Error(`Game set ${game.setId} not found`);

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

    // Get all players in this game
    const allPlayers = await db
      .select({
        checkinId: checkins.id,
        userId: checkins.userId,
        username: users.username,
      })
      .from(gamePlayers)
      .innerJoin(users, eq(gamePlayers.userId, users.id))
      .innerJoin(checkins, and(
        eq(checkins.userId, gamePlayers.userId),
        eq(checkins.gameId, gameId)
      ))
      .where(eq(gamePlayers.gameId, gameId));

    console.log('Game ended:', {
      gameId,
      playersCount: allPlayers.length,
      players: allPlayers.map(p => p.username)
    });

    // Set all players' checkins to inactive
    for (const player of allPlayers) {
      console.log(`Deactivating checkin for player ${player.username}`);
      await db
        .update(checkins)
        .set({ isActive: false })
        .where(eq(checkins.id, player.checkinId));
    }

    // Increment current queue position by players_per_team * 2 (for both teams)
    const newQueuePosition = gameSet.currentQueuePosition + (gameSet.playersPerTeam * 2);
    console.log(`Updating game set ${gameSet.id} current_queue_position from ${gameSet.currentQueuePosition} to ${newQueuePosition}`);

    await db
      .update(gameSets)
      .set({
        currentQueuePosition: newQueuePosition
      })
      .where(eq(gameSets.id, gameSet.id));

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

    // Deactivate all active checkins
    await db
      .update(checkins)
      .set({ isActive: false })
      .where(eq(checkins.isActive, true));

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

  async updateCheckins(setId: number, gameState: GameState): Promise<void> {
    const today = getDateString(getCentralTime());

    // Get current active checkins to preserve queue positions
    const currentCheckins = await db
      .select()
      .from(checkins)
      .where(
        and(
          eq(checkins.clubIndex, 34),
          eq(checkins.checkInDate, today),
          eq(checkins.isActive, true)
        )
      );

    // Create a map of userId to current queue position
    const currentPositions = new Map(
      currentCheckins.map(c => [c.userId, c.queuePosition])
    );

    // Deactivate all current checkins
    await db
      .update(checkins)
      .set({ isActive: false })
      .where(
        and(
          eq(checkins.clubIndex, 34),
          eq(checkins.checkInDate, today),
          eq(checkins.isActive, true)
        )
      );

    // Create new checkins for players based on their positions in the game state
    // This preserves the order from the game state
    const allPlayers = [
      ...gameState.teamA.players,
      ...gameState.teamB.players,
      ...gameState.availablePlayers
    ];

    for (let i = 0; i < allPlayers.length; i++) {
      const player = allPlayers[i];
      await db
        .insert(checkins)
        .values({
          userId: player.id,
          clubIndex: 34,
          checkInTime: getCentralTime(),
          isActive: true,
          checkInDate: today,
          gameSetId: setId,
          queuePosition: i + 1, // Use position from game state order
          type: 'manual'
        });
    }
  }

  async createGamePlayer(gameId: number, userId: number, team: number): Promise<GamePlayer> {
    console.log(`Creating game player for user ${userId} in game ${gameId} on team ${team}`);

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
}

export const storage = new DatabaseStorage();

if (process.env.ADMIN_INITIAL_PASSWORD) {
  const scryptAsync = promisify(scrypt);

  async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  }

  hashPassword(process.env.ADMIN_INITIAL_PASSWORD).then(async hashedPassword => {
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
    }
  });
}