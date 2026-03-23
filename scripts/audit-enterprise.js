#!/usr/bin/env node
/* eslint-disable no-console */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function runStep(command, env = process.env) {
  console.log(`[audit:enterprise] ${command}`);
  const result = spawnSync(command, {
    stdio: 'inherit',
    shell: true,
    env,
  });
  if (result.status !== 0) {
    throw new Error(`Step failed: ${command}`);
  }
}

function resolveSeededTransferEnv() {
  const seedPath = path.resolve(__dirname, '..', 'output', 'audit', 'db', 'seed-latest.json');
  if (!fs.existsSync(seedPath)) {
    throw new Error(`Seed artifact not found: ${seedPath}`);
  }

  const seedSummary = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const fromStockroomId = seedSummary?.ids?.sourceStockroomId;
  const toStockroomId = seedSummary?.ids?.destinationStockroomId;

  if (!fromStockroomId || !toStockroomId) {
    throw new Error(
      `Seed artifact is missing stockroom ids (sourceStockroomId/destinationStockroomId): ${seedPath}`
    );
  }

  return {
    E2E_SEED_FROM_STOCKROOM_ID: String(fromStockroomId),
    E2E_SEED_TO_STOCKROOM_ID: String(toStockroomId),
  };
}

function main() {
  let seeded = false;
  let failed = null;
  const backendAuditEnv = {
    ...process.env,
    AUDIT_DB_FORCE_DATA_API: process.env.AUDIT_DB_FORCE_DATA_API || '1',
  };

  try {
    runStep('npm --prefix backend run contract:all:model');
    runStep('npm --prefix backend run contract:routes:runtime');
    runStep('npm --prefix backend run audit:seed', backendAuditEnv);
    seeded = true;
    runStep('npm --prefix backend run audit:db:wiring', backendAuditEnv);
    const transferEnv = resolveSeededTransferEnv();
    runStep('npm run e2e:real-api', {
      ...process.env,
      E2E_REAL_API: '1',
      ...transferEnv,
    });
  } catch (error) {
    failed = error;
  } finally {
    if (seeded) {
      try {
        runStep('npm --prefix backend run audit:cleanup', backendAuditEnv);
      } catch (cleanupError) {
        if (!failed) {
          failed = cleanupError;
        } else {
          console.error('[audit:enterprise] cleanup failed:', String(cleanupError));
        }
      }
    }
  }

  if (failed) {
    throw failed;
  }
  console.log('[audit:enterprise] all gates passed');
}

try {
  main();
} catch (error) {
  console.error('[audit:enterprise] failed', error);
  process.exitCode = 1;
}
