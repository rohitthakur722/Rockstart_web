const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const compression = require("compression");
const routes = require("./routes");
const notFound = require("./middleware/notFound.middleware");
const errorMiddleware = require("./middleware/error.middleware");
const requestLogger = require("./middleware/requestLogger.middleware");
const { generalApiLimiter } = require("./middleware/rateLimit.middleware");

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// Only trust X-Forwarded-* when explicitly told to (behind a real reverse
// proxy/load balancer) — otherwise req.ip/req.secure could be spoofed by the
// client, which would also undermine the per-account rate limiters below.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : process.env.TRUST_PROXY);
}

const allowedOrigin = process.env.CLIENT_URL || "http://localhost:5173";

// Same-origin by default (scripts/styles from this app only); connect-src
// allows the API origin itself (XHR/fetch) and img-src/media-src allow this
// server's own /uploads (covers, profiles) and the streaming endpoint.
// Development relaxes connect-src/script-src for Vite's dev server and HMR
// websocket; this relaxation never applies in production.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        connectSrc: isProduction ? ["'self'"] : ["'self'", "ws:", "http://localhost:*"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(compression());
app.use(requestLogger);

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// A much smaller limit than Multer's music/image caps — every JSON-body
// endpoint (auth, profile, catalog metadata, likes, playlists, preferences,
// admin actions) sends small payloads; file uploads go through
// multipart/form-data + Multer instead, which has its own configured limits.
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

app.use("/api", generalApiLimiter);

// Profile avatars and song/album covers are served as plain static files.
// Music audio is never served through express.static — it only leaves the
// server through GET /api/songs/:songId/stream, which enforces publication
// and ownership access rules before streaming any bytes.
const staticUploadOptions = { maxAge: "7d", index: false, dotfiles: "deny" };
app.use("/uploads/profiles", express.static(path.join(__dirname, "uploads", "profiles"), staticUploadOptions));
app.use("/uploads/covers", express.static(path.join(__dirname, "uploads", "covers"), staticUploadOptions));

app.use("/api", routes);

app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
