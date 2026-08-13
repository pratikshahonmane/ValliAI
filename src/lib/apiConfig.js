// process.env.API_BASE_URL is substituted at build time by webpack.DefinePlugin
// (see webpack.config.mjs), sourced from the .env file. Copy .env.example to
// .env and edit it to point at your backend.
export const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

export const ENDPOINTS = {
  score: "/score",
  scoreBatch: "/score/batch",
};
