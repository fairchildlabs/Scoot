import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  birthYear: integer("birth_year").notNull(),
  birthMonth: integer("birth_month"),
  birthDay: integer("birth_day"),
  isPlayer: boolean("is_player").notNull().default(true),
  isBank: boolean("is_bank").notNull().default(false),
  isBook: boolean("is_book").notNull().default(false),
  isEngineer: boolean("is_engineer").notNull().default(false),
  isRoot: boolean("is_root").notNull().default(false),
});

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  team1Score: integer("team1_score"),
  team2Score: integer("team2_score"),
  clubIndex: integer("club_index").notNull().default(34),
});

export const checkins = pgTable("checkins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  checkInTime: timestamp("check_in_time").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  clubIndex: integer("club_index").notNull().default(34),
  checkInDate: text("check_in_date").notNull(), // Store date in YYYY-MM-DD format
});

export const gamePlayers = pgTable("game_players", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull(),
  userId: integer("user_id").notNull(),
  team: integer("team").notNull(), // 1 or 2
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  birthYear: true,
  birthMonth: true,
  birthDay: true,
  isPlayer: true,
  isBank: true,
  isBook: true,
  isEngineer: true,
  isRoot: true,
}).extend({
  birthYear: z.number().min(1900).max(new Date().getFullYear()),
  birthMonth: z.number().min(1).max(12).optional(),
  birthDay: z.number().min(1).max(31).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
});

export const insertGameSchema = createInsertSchema(games);
export const insertCheckinSchema = createInsertSchema(checkins);
export const insertGamePlayerSchema = createInsertSchema(gamePlayers);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Checkin = typeof checkins.$inferSelect;
export type GamePlayer = typeof gamePlayers.$inferSelect;