"use strict";

const { apiError } = require("../../utils/errors");

function apiNotFound(req, res, next) {
  next(apiError(404, "API_NOT_FOUND", "API-Endpunkt nicht gefunden"));
}

module.exports = { apiNotFound };