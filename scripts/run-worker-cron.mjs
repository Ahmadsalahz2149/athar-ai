import fs from "node:fs";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import path from "node:path";

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[name] = value;
  }
  return values;
}

const envFile = process.env.ATHAR_ENV_FILE || path.resolve(process.cwd(), ".env.production");
const fileEnv = parseEnv(envFile);
const secret = process.env.WORKER_SECRET || fileEnv.WORKER_SECRET;
const baseUrl = process.env.OAUTH_BASE_URL || fileEnv.OAUTH_BASE_URL || "https://athargrowth.com";

if (!secret) throw new Error("WORKER_SECRET is missing; refusing to call the worker without authentication.");

const workerUrl = new URL("/api/worker", baseUrl);
const request = workerUrl.protocol === "https:" ? httpsRequest : httpRequest;
const { status, payload } = await new Promise((resolve, reject) => {
  const req = request(workerUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  }, (res) => {
    res.setEncoding("utf8");
    let body = "";
    res.on("data", (chunk) => { body += chunk; });
    res.on("end", () => resolve({ status: res.statusCode ?? 0, payload: body }));
  });
  // Node fetch/Undici applies a five-minute headers timeout even when its abort
  // signal is longer. The core request API lets large throttled jobs and any
  // provider Retry-After pauses use a full twenty-minute window, while flock
  // still prevents overlapping cron calls.
  req.setTimeout(20 * 60_000, () => req.destroy(new Error("Worker request timed out after 20 minutes")));
  req.on("error", reject);
  req.end();
});

if (status < 200 || status >= 300) throw new Error(`Worker returned HTTP ${status}: ${payload.slice(0, 300)}`);

const result = JSON.parse(payload);
if (result.processed || result.reaped) {
  console.log(`${new Date().toISOString()} worker processed=${result.processed ?? 0} reaped=${result.reaped ?? 0}`);
}
