// Axios client for the FastAPI backend (see backend/app/main.py). Replaces
// the client-side mock scoring path for both single-transaction and CSV
// batch scoring -- responses shown in the UI now come from the backend.
import axios from "axios";
import { API_BASE_URL, ENDPOINTS } from "../lib/apiConfig";

const DEFAULT_TIMEOUT_MS = 15000;

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
});

export class ApiError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.cause = cause;
  }
}

function toApiError(err) {
  if (err.response) {
    const body = err.response.data;
    const detail = body && typeof body === "object" ? body.detail || body.message : null;
    const message =
      (typeof detail === "string" && detail) ||
      (typeof body === "string" && body) ||
      `Request failed with status ${err.response.status}`;
    return new ApiError(message, { status: err.response.status, cause: err });
  }
  if (err.code === "ECONNABORTED") {
    return new ApiError(`Request timed out after ${DEFAULT_TIMEOUT_MS / 1000}s.`, { cause: err });
  }
  return new ApiError(
    `Could not reach ${API_BASE_URL}. Is the backend running, and does it allow CORS from this origin?`,
    { cause: err }
  );
}

// POST /score -- scores a single transaction, returns the backend's response as-is.
export async function scoreTransactionApi(request) {
  try {
    const { data } = await client.post(ENDPOINTS.score, request);
    return data;
  } catch (err) {
    throw toApiError(err);
  }
}

// POST /score/batch -- uploads a CSV file for server-side parsing + scoring.
// Returns { results: [...] }, each entry either { rowIndex, request, response }
// (scored) or { rowIndex, error, raw } (failed validation).
export async function scoreBatchApi(file, onUploadProgress) {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const { data } = await client.post(ENDPOINTS.scoreBatch, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    });
    return data;
  } catch (err) {
    throw toApiError(err);
  }
}
