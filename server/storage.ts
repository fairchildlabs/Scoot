import { User, InsertUser, Game, Checkin, GamePlayer } from "@shared/schema";
import createMemoryStore from "memorystore";
import session from "express-session";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getCheckins(clubIndex: number): Promise<(Checkin & { username: string })[]>;
  createCheckin(userId: number, clubIndex: number): Promise<Checkin>;
  deactivateCheckin(checkinId: number): Promise<void>;
  
  createGame(players: number[], clubIndex: number): Promise<Game>;
  updateGameScore(gameId: number, team1Score: number, team2Score: number): Promise<Game>;
  
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private checkins: Map<number, Checkin>;
  private games: Map<number, Game>;
  private gamePlayers: Map<number, GamePlayer[]>;
  
  currentId: {
    users: number;
    checkins: number;
    games: number;
    gamePlayers: number;
  };

  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.checkins = new Map();
    this.games = new Map();
    this.gamePlayers = new Map();
    
    this.currentId = {
      users: 1,
      checkins: 1,
      games: 1,
      gamePlayers: 1,
    };
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId.users++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getCheckins(clubIndex: number): Promise<(Checkin & { username: string })[]> {
    return Array.from(this.checkins.values())
      .filter(c => c.clubIndex === clubIndex && c.isActive)
      .map(checkin => {
        const user = this.users.get(checkin.userId);
        return {
          ...checkin,
          username: user?.username || 'Unknown',
        };
      })
      .sort((a, b) => a.checkInTime.getTime() - b.checkInTime.getTime());
  }

  async createCheckin(userId: number, clubIndex: number): Promise<Checkin> {
    const id = this.currentId.checkins++;
    const checkin: Checkin = {
      id,
      userId,
      clubIndex,
      checkInTime: new Date(),
      isActive: true,
    };
    this.checkins.set(id, checkin);
    return checkin;
  }

  async deactivateCheckin(checkinId: number): Promise<void> {
    const checkin = this.checkins.get(checkinId);
    if (checkin) {
      checkin.isActive = false;
      this.checkins.set(checkinId, checkin);
    }
  }

  async createGame(players: number[], clubIndex: number): Promise<Game> {
    const id = this.currentId.games++;
    const game: Game = {
      id,
      startTime: new Date(),
      endTime: null,
      team1Score: null,
      team2Score: null,
      clubIndex,
    };
    this.games.set(id, game);
    
    const gamePlayers = players.map((userId, index) => ({
      id: this.currentId.gamePlayers++,
      gameId: id,
      userId,
      team: index < (players.length / 2) ? 1 : 2,
    }));
    
    this.gamePlayers.set(id, gamePlayers);
    return game;
  }

  async updateGameScore(gameId: number, team1Score: number, team2Score: number): Promise<Game> {
    const game = this.games.get(gameId);
    if (!game) throw new Error("Game not found");
    
    const updatedGame: Game = {
      ...game,
      team1Score,
      team2Score,
      endTime: new Date(),
    };
    
    this.games.set(gameId, updatedGame);
    return updatedGame;
  }
}

export const storage = new MemStorage();

storage.createUser({
  username: "scuzzydude",
  password: "Hakeem.34",
  isPlayer: true,
  isBank: true,
  isBook: true,
  isEngineer: true,
  isRoot: true,
});