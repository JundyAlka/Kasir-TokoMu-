import spawn from 'cross-spawn';

const envVars = {
  "DATABASE_URL": "postgresql://postgres:0a8d012736ad8dabcd543d58c94fed1c@rnuh6nq3.us-east.database.insforge.app:5432/insforge?sslmode=require",
  "BETTER_AUTH_SECRET": "MuZmPjxaAxALgft1g0Zr2YZXWK3FF9HRs3ESlXzsLP8=",
  "BETTER_AUTH_URL": "https://rnuh6nq3.insforge.site",
  "GEMINI_API_KEY": "sk-rG1iXdCmkaj9g6Nfkk4TllKbHIKlliF3qz6faEjRVksxjfYH",
  "GEMINI_BASE_URL": "https://api.hcnsec.cn/v1",
  "GEMINI_TEXT_MODEL": "gemini-2.5-flash",
  "GEMINI_FALLBACK_TEXT_MODEL": "gemini-2.0-flash-lite",
  "GEMINI_FALLBACK_TEXT_MODEL_PINNED": "gemini-2.0-flash-lite-001",
  "GEMINI_VISION_MODEL": "Kimi-K2.6",
  "GEMINI_FALLBACK_VISION_MODEL": "Kimi-K2.6",
  "GEMINI_GOOGLE_API_KEYS": "AIzaSyAAXo25OMoKOiAX6YbiYiI4HbpA4zJDpJo,AIzaSyA3r8oKJhx5UEr9QHeOZzx9JMGX0THnmc0,AIzaSyAvPigOlnm_tgb3hVkquaq0E_57xnYr6Lk,AIzaSyA7JqR3I0WdbDv_xs9S7KlFZMfP-ui54Mc,AIzaSyA4sX-H2oMCGaacvLPDNXQGrm7V26gBrnM"
};

const jsonStr = JSON.stringify(envVars);

console.log("Deploying with environment variables via cross-spawn...");

const child = spawn('npx', ['@insforge/cli', 'deployments', 'deploy', '--env', jsonStr], {
  stdio: 'inherit'
});

child.on('close', (code) => {
  console.log(`Deployment exited with code ${code}`);
});
