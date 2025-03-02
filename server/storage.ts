import { users, type User, type InsertUser, checkins, type Checkin, type Game, games, type GamePlayer, gamePlayers } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const PostgresSessionStore = connectPg(session);
const scryptAsync = promisify(scrypt);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getCheckins(clubIndex: number): Promise<(Checkin & { username: string })[]>;
  createCheckin(userId: number, clubIndex: number): Promise<Checkin>;
  deactivateCheckin(checkinId: number): Promise<void>;

  createGame(players: number[], clubIndex: number): Promise<Game>;
  updateGameScore(gameId: number, team1Score: number, team2Score: number): Promise<Game>;

  getAllUsers(): Promise<User[]>;

  sessionStore: session.Store;
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
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getCheckins(clubIndex: number): Promise<(Checkin & { username: string })[]> {
    const results = await db
      .select({
        id: checkins.id,
        userId: checkins.userId,
        checkInTime: checkins.checkInTime,
        isActive: checkins.isActive,
        clubIndex: checkins.clubIndex,
        username: users.username
      })
      .from(checkins)
      .innerJoin(users, eq(checkins.userId, users.id))
      .where(
        and(
          eq(checkins.clubIndex, clubIndex),
          eq(checkins.isActive, true)
        )
      );

    return results;
  }

  async createCheckin(userId: number, clubIndex: number): Promise<Checkin> {
    const [checkin] = await db
      .insert(checkins)
      .values({
        userId,
        clubIndex,
        checkInTime: new Date(),
        isActive: true,
      })
      .returning();
    return checkin;
  }

  async deactivateCheckin(checkinId: number): Promise<void> {
    await db
      .update(checkins)
      .set({ isActive: false })
      .where(eq(checkins.id, checkinId));
  }

  async createGame(players: number[], clubIndex: number): Promise<Game> {
    const [game] = await db
      .insert(games)
      .values({
        startTime: new Date(),
        clubIndex,
      })
      .returning();

    const gamePlayerValues = players.map((userId, index) => ({
      gameId: game.id,
      userId,
      team: index < (players.length / 2) ? 1 : 2,
    }));

    await db.insert(gamePlayers).values(gamePlayerValues);
    return game;
  }

  async updateGameScore(gameId: number, team1Score: number, team2Score: number): Promise<Game> {
    const [game] = await db
      .update(games)
      .set({
        team1Score,
        team2Score,
        endTime: new Date(),
      })
      .where(eq(games.id, gameId))
      .returning();
    return game;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
}

export const storage = new DatabaseStorage();

// Create initial admin user with hashed password
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// Create initial admin user if ADMIN_INITIAL_PASSWORD is set
if (process.env.ADMIN_INITIAL_PASSWORD) {
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