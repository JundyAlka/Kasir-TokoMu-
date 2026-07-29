import spawn from 'cross-spawn';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read secrets from .env.deploy (gitignored) or fall back to .env
function loadEnvFile(filename) {
  try {
    const content = readFileSync(resolve(filename), 'utf-8');
    const vars = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      vars[key] = value;
    }
    return vars;
  } catch {
    return null;
  }
}

const deployEnv = loadEnvFile('.env.deploy') || loadEnvFile('.env');
if (!deployEnv || !deployEnv.DATABASE_URL) {
  console.error('Error: Could not load .env.deploy or .env');
  process.exit(1);
}

const envVars = {
  "DATABASE_URL": deployEnv.DATABASE_URL,
  "BETTER_AUTH_SECRET": deployEnv.BETTER_AUTH_SECRET || "",
  "BETTER_AUTH_URL": deployEnv.BETTER_AUTH_URL || "https://rnuh6nq3.insforge.site",
  "GEMINI_API_KEY": deployEnv.GEMINI_API_KEY || "",
  "GEMINI_BASE_URL": deployEnv.GEMINI_BASE_URL || "",
  "GEMINI_TEXT_MODEL": deployEnv.GEMINI_TEXT_MODEL || "gemini-3.6-flash",
  "GEMINI_FALLBACK_TEXT_MODEL": deployEnv.GEMINI_FALLBACK_TEXT_MODEL || "gemini-3.6-flash",
  "GEMINI_FALLBACK_TEXT_MODEL_PINNED": deployEnv.GEMINI_FALLBACK_TEXT_MODEL_PINNED || "gemini-3.6-flash",
  "GEMINI_VISION_MODEL": deployEnv.GEMINI_VISION_MODEL || "gemini-3.6-flash",
  "GEMINI_FALLBACK_VISION_MODEL": deployEnv.GEMINI_FALLBACK_VISION_MODEL || "gemini-3.6-flash",
  "GEMINI_GOOGLE_API_KEYS": deployEnv.GEMINI_GOOGLE_API_KEYS || "",
};

const jsonStr = JSON.stringify(envVars);

console.log("Deploying with environment variables via cross-spawn...");
console.log("Models:", envVars.GEMINI_TEXT_MODEL, "| Key type:", envVars.GEMINI_API_KEY.startsWith("AQ.") ? "InsForge Auth" : "Proxy");

const child = spawn('npx', ['@insforge/cli', 'deployments', 'deploy', '--env', jsonStr], {
  stdio: 'inherit'
});

child.on('close', (code) => {
  console.log(`Deployment exited with code ${code}`);
});
