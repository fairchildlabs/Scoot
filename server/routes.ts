import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.user!.isEngineer && !req.user!.isRoot) return res.sendStatus(403);
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.get("/api/checkins", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const checkins = await storage.getCheckins(34);
    res.json(checkins);
  });

  app.post("/api/checkins", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Check if user already has an active check-in for today
    const existingCheckins = await storage.getCheckins(34);
    const userAlreadyCheckedIn = existingCheckins.some(
      checkin => checkin.userId === req.user!.id
    );

    if (userAlreadyCheckedIn) {
      return res.status(400).send("You are already checked in for today");
    }

    const checkin = await storage.createCheckin(req.user!.id, 34);
    res.json(checkin);
  });

  app.post("/api/games", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.user!.isEngineer) return res.sendStatus(403);

    const { players } = req.body;
    const game = await storage.createGame(players, 34);

    // Deactivate checkins for players in the game
    await Promise.all(players.map((playerId: number) =>
      storage.deactivateCheckin(playerId)
    ));

    res.json(game);
  });

  app.patch("/api/games/:id/score", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.user!.isEngineer) return res.sendStatus(403);

    const { team1Score, team2Score } = req.body;
    const game = await storage.updateGameScore(
      parseInt(req.params.id),
      team1Score,
      team2Score
    );

    res.json(game);
  });

  const httpServer = createServer(app);
  return httpServer;
}