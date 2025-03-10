import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertGameSetSchema, games } from "@shared/schema";
import { populateGame, movePlayer, MoveType } from "./game-logic/game-population";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.user!.isEngineer && !req.user!.isRoot) return res.sendStatus(403);
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.patch("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.user!.isEngineer && !req.user!.isRoot) return res.sendStatus(403);

    const userId = parseInt(req.params.id);
    const user = await storage.updateUser(userId, req.body);
    res.json(user);
  });

  app.get("/api/checkins", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const checkins = await storage.getCheckins(34);

    // Get complete user data for each checkin
    const checkinsWithUserData = await Promise.all(
      checkins.map(async (checkin) => {
        const user = await storage.getUser(checkin.userId);
        return {
          ...checkin,
          birthYear: user?.birthYear
        };
      })
    );

    res.json(checkinsWithUserData);
  });

  app.post("/api/checkins", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    // Only prevent duplicate check-ins if the user is checking themselves in
    if (!req.user!.isEngineer && !req.user!.isRoot) {
      const existingCheckins = await storage.getCheckins(34);
      const userAlreadyCheckedIn = existingCheckins.some(
        checkin => checkin.userId === req.user!.id
      );

      if (userAlreadyCheckedIn) {
        return res.status(400).send("You are already checked in for today");
      }
    }

    const userId = req.user!.isEngineer || req.user!.isRoot ? req.body.userId : req.user!.id;
    const checkin = await storage.createCheckin(userId, 34);
    res.json(checkin);
  });

  app.post("/api/checkins/clear", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.user!.isEngineer && !req.user!.isRoot) return res.sendStatus(403);

    try {
      // Get all active checkins
      const checkins = await storage.getCheckins(34);

      console.log('POST /api/checkins/clear - Deactivating checkins:', 
        checkins.map(c => ({ id: c.id, userId: c.userId, username: c.username }))
      );

      // Deactivate all checkins
      for (const checkin of checkins) {
        await storage.deactivateCheckin(checkin.id);
      }

      console.log('POST /api/checkins/clear - Successfully deactivated all checkins');
      res.sendStatus(200);
    } catch (error) {
      console.error('POST /api/checkins/clear - Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/games", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.user!.isEngineer) return res.sendStatus(403);

    try {
      console.log('POST /api/games - Request body:', req.body);

      if (!req.body.setId) {
        console.error('POST /api/games - Missing setId in request');
        return res.status(400).send("Missing setId");
      }

      // Create the game
      const game = await storage.createGame(
        req.body.setId,
        req.body.court || 'West',
        'started'  // Set initial state
      );

      console.log('POST /api/games - Created game:', game);

      // Create player associations if provided
      if (req.body.players && Array.isArray(req.body.players)) {
        await Promise.all(
          req.body.players.map(async (player: { userId: number; team: number }) => {
            await storage.createGamePlayer(game.id, player.userId, player.team);
          })
        );
      }

      // Fetch the complete game data with players
      const completeGame = await storage.getGame(game.id);
      res.json(completeGame);
    } catch (error) {
      console.error('POST /api/games - Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.patch("/api/games/:id/score", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.user!.isEngineer) return res.sendStatus(403);

    try {
      const { team1Score, team2Score } = req.body;
      const gameId = parseInt(req.params.id);

      console.log(`PATCH /api/games/${gameId}/score - Processing score update:`, { team1Score, team2Score });

      // Get the current game with player info
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }

      // Update game with scores and set state to 'final'
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

      // Determine winning and losing teams
      const winningTeam = team1Score > team2Score ? 1 : 2;
      const losingTeam = winningTeam === 1 ? 2 : 1;

      // Get all players from the losing team
      const losingPlayers = game.players.filter(p => p.team === losingTeam);

      console.log('Game ended:', {
        gameId,
        winningTeam,
        losingTeam,
        losingPlayers: losingPlayers.map(p => p.username)
      });

      // First deactivate existing checkins for losing players
      for (const player of losingPlayers) {
        const existingCheckins = await db
          .select()
          .from(checkins)
          .where(
            and(
              eq(checkins.userId, player.userId),
              eq(checkins.isActive, true),
              eq(checkins.clubIndex, 34)
            )
          );

        // Deactivate any existing active checkins
        for (const checkin of existingCheckins) {
          await storage.deactivateCheckin(checkin.id);
          console.log(`Deactivated existing checkin for player ${player.username}`);
        }

        // Create new checkin to put them at the end of the queue
        await storage.createCheckin(player.userId, 34);
        console.log(`Created new checkin for player ${player.username}`);
      }

      res.json(updatedGame);
    } catch (error) {
      console.error('PATCH /api/games/:id/score - Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.post("/api/game-sets", async (req, res) => {
    console.log('POST /api/game-sets - Request received');
    if (!req.isAuthenticated()) {
      console.log('POST /api/game-sets - Unauthorized');
      return res.sendStatus(401);
    }
    if (!req.user!.isEngineer) {
      console.log('POST /api/game-sets - Forbidden');
      return res.sendStatus(403);
    }

    try {
      console.log('POST /api/game-sets - Request body:', req.body);
      const validatedData = insertGameSetSchema.parse(req.body);
      console.log('POST /api/game-sets - Validated data:', validatedData);
      const gameSet = await storage.createGameSet(req.user!.id, validatedData);
      console.log('POST /api/game-sets - Created game set:', gameSet);
      res.json(gameSet);
    } catch (error) {
      console.error('POST /api/game-sets - Error:', error);
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/api/game-sets/active", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const gameSet = await storage.getActiveGameSet();
    res.json(gameSet || null);
  });

  app.get("/api/game-sets", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const gameSets = await storage.getAllGameSets();
    res.json(gameSets);
  });

  app.post("/api/game-sets/:id/deactivate", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.user!.isEngineer) return res.sendStatus(403);

    await storage.deactivateGameSet(parseInt(req.params.id));
    res.sendStatus(200);
  });

  app.post("/api/player-move", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.user!.isEngineer && !req.user!.isRoot) return res.sendStatus(403);

    const { playerId, moveType, setId } = req.body;

    try {
      console.log('POST /api/player-move - Request:', { playerId, moveType, setId });

      // Get current game state
      const gameState = await populateGame(setId);
      console.log('Current game state:', gameState);

      // Apply the move
      const result = movePlayer(gameState, playerId, moveType as MoveType);

      if (!result.success) {
        console.log('Move failed:', result.message);
        return res.status(400).json({ error: result.message });
      }

      // Update the checkins based on the new state
      await storage.updateCheckins(setId, result.updatedState);

      // Return the new state
      res.json(result.updatedState);
    } catch (error: any) {
      console.error('Player move failed:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/games/active", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      // Get active game set to know how many games to return
      const activeGameSet = await storage.getActiveGameSet();
      if (!activeGameSet) {
        return res.json([]);
      }

      // Get all games (both started and final) from the current game set
      const allGames = await db
        .select()
        .from(games)
        .where(
          and(
            sql`${games.state} IN ('started', 'final')`,
            eq(games.setId, activeGameSet.id)
          )
        );

      // Get complete game data with players for each game
      const gamesWithPlayers = await Promise.all(
        allGames.map(game => storage.getGame(game.id))
      );

      console.log('GET /api/games/active - Returning games:', gamesWithPlayers);
      res.json(gamesWithPlayers);
    } catch (error) {
      console.error('GET /api/games/active - Error:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}