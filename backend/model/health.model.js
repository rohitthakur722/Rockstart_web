const { query } = require("../config/db");

const getDatabaseTime = async () => {
  const result = await query("SELECT NOW() AS database_time");
  return result.rows[0].database_time;
};

module.exports = { getDatabaseTime };
