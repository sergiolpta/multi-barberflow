// backend/src/utils/logger.js
function safeErr(err) {
  if (!err) return null;
  return {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  };
}

export const logger = {
  info(msg, meta = {}) {
    if (process.env.NODE_ENV !== "production") {
      console.log(JSON.stringify({ level: "info", msg, ...meta }));
    }
  },
  warn(msg, meta = {}) {
    console.warn(JSON.stringify({ level: "warn", msg, ...meta }));
  },
  error(msg, err, meta = {}) {
    console.error(
      JSON.stringify({ level: "error", msg, error: safeErr(err), ...meta })
    );
  },
};

