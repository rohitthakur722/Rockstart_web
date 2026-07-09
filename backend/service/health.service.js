const healthModel = require("../model/health.model");

const getHealthStatus = async () => {
  try {
    const databaseTime = await healthModel.getDatabaseTime();
    return {
      databaseConnected: true,
      databaseTime,
    };
  } catch (err) {
    return {
      databaseConnected: false,
      databaseTime: null,
    };
  }
};

module.exports = { getHealthStatus };
