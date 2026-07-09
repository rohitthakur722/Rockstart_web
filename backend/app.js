const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const routes = require("./routes");
const notFound = require("./middleware/notFound.middleware");
const errorMiddleware = require("./middleware/error.middleware");

const app = express();

const allowedOrigin = process.env.CLIENT_URL || "http://localhost:5173";

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

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
