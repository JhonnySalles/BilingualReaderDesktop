const net = require('net');
const fs = require('fs');
const path = require('path');
const concurrentlyMod = require('concurrently');
const concurrently = concurrentlyMod.default || concurrentlyMod.concurrently || concurrentlyMod;

function readEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return {};
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    const result = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        const val = trimmed.slice(eqIndex + 1).trim();
        result[key] = val;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

function getRandomAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function resolvePort() {
  const envVars = readEnvFile();
  const rawPort = process.env.DEV_PORT || process.env.PORT || envVars.DEV_PORT || envVars.PORT;

  if (rawPort) {
    const parsed = parseInt(rawPort, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) {
      const available = await isPortAvailable(parsed);
      if (available) {
        console.log(`\x1b[36m[dev]\x1b[0m Usando porta configurada no .env: \x1b[32m${parsed}\x1b[0m`);
        return parsed;
      }
      console.warn(`\x1b[33m[dev]\x1b[0m A porta configurada (${parsed}) já está em uso por outro projeto/instância.`);
    }
  }

  const randomPort = await getRandomAvailablePort();
  console.log(`\x1b[36m[dev]\x1b[0m Alocando porta dinâmica disponível: \x1b[32m${randomPort}\x1b[0m`);
  return randomPort;
}

async function start() {
  try {
    const port = await resolvePort();

    const env = {
      ...process.env,
      DEV_PORT: String(port),
      DEV_SERVER_PORT: String(port),
      ELECTRON_START_URL: `http://127.0.0.1:${port}`
    };

    const { result } = concurrently(
      [
        {
          command: `ng serve --port ${port} --host 127.0.0.1`,
          name: 'ng',
          prefixColor: 'cyan',
          env
        },
        {
          command: 'tsc -p tsconfig.electron.json --watch',
          name: 'tsc',
          prefixColor: 'blue',
          env
        },
        {
          command: `wait-on http://127.0.0.1:${port} && electron .`,
          name: 'electron',
          prefixColor: 'magenta',
          env
        }
      ],
      {
        killOthers: ['failure', 'success'],
        restartTries: 0
      }
    );

    result.catch(() => {});
  } catch (err) {
    console.error('[dev] Erro ao iniciar ambiente de desenvolvimento:', err);
    process.exit(1);
  }
}

start();
