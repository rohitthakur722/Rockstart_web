// Concise structured request log — method, route, status, duration. Never
// logs headers, cookies, query/body values, or anything that could contain a
// credential, so it's safe to enable in production (where stack traces and
// verbose error bodies are already suppressed by error.middleware.js).
const requestLogger = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const route = req.route ? `${req.baseUrl}${req.route.path}` : req.path;

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        method: req.method,
        route,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
      })
    );
  });

  next();
};

module.exports = requestLogger;
