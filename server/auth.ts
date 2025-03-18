import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  console.log("Initializing authentication setup...");

  console.log("Configuring session settings...");
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage().sessionStore,
  };

  console.log("Setting up trust proxy and session middleware...");
  app.set("trust proxy", 1);
  app.use(session(sessionSettings));

  console.log("Initializing Passport...");
  app.use(passport.initialize());
  app.use(passport.session());

  console.log("Configuring Passport local strategy...");
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage().getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage().getUser(id);
    done(null, user);
  });

  // Auth routes with logging
  app.post("/api/register", async (req, res, next) => {
    console.log("Processing registration request...");
    const existingUser = await storage().getUserByUsername(req.body.username);
    if (existingUser) {
      console.log("Registration failed: Username already exists");
      return res.status(400).send("Username already exists");
    }

    const user = await storage().createUser({
      ...req.body,
      password: await hashPassword(req.body.password),
    });

    console.log("User registration successful");
    res.status(201).json(user);
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    console.log("User login successful");
    res.status(200).json(req.user);
  });

  app.post("/api/logout", (req, res, next) => {
    console.log("Processing logout request...");
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return next(err);
      }
      console.log("User logout successful");
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  console.log("Authentication setup completed successfully");
}