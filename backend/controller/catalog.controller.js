const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const catalogService = require("../service/catalog.service");

const getHome = asyncHandler(async (req, res) => {
  const home = await catalogService.getHomeCatalog();
  return sendSuccess(res, { message: "Catalog home retrieved.", data: home });
});

module.exports = { getHome };
