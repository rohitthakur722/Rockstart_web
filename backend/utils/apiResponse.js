const sendSuccess = (res, { statusCode = 200, message = "Success", data = null } = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const sendError = (res, { statusCode = 500, message = "Something went wrong", errors = [] } = {}) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = { sendSuccess, sendError };
