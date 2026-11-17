// Vercel Function for every /api/* path (vercel.json rewrites them here; the URL keeps the original path).
import { productionApi } from '../server/runtime.mjs';

let api;
async function handle(request) {
  api ??= productionApi();
  return (await api)(request);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
