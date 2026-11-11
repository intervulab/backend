#!/usr/bin/env node
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../.pgdata');

mkdirSync(dataDir, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'interviewlab',
  password: 'interviewlab',
  port: 5432,
  persistent: true,
});

if (!existsSync(path.join(dataDir, 'PG_VERSION'))) {
  await pg.initialise();
}
await pg.start();

const url =
  'postgresql://interviewlab:interviewlab@localhost:5432/postgres?schema=public';
const envPath = path.join(__dirname, '../.env.runtime');
writeFileSync(
  envPath,
  `DATABASE_URL="${url}"\nPORT=4000\nJWT_SECRET=dev_secret\nAGENT_SERVICE_URL=http://localhost:8000/api/v1\nML_SERVICE_URL=http://localhost:8001/api/v1\n`
);

console.log('Embedded Postgres started on 5432');
console.log(`Wrote ${envPath}`);

process.on('SIGINT', async () => {
  await pg.stop();
  process.exit(0);
});
