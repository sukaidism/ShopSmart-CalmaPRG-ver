// Stream a private RDS backup to stdout; the caller chooses a private output file.
const { spawnSync } = require('node:child_process');
const url = new URL(process.env.DATABASE_URL);
if (!url.hostname.endsWith('.rds.amazonaws.com')) throw new Error('Expected the configured RDS endpoint.');
const result = spawnSync('pg_dump', ['--host', url.hostname, '--port', url.port || '5432', '--username', decodeURIComponent(url.username), '--dbname', url.pathname.slice(1), '--format=custom'], {
  stdio: ['ignore', 'inherit', 'inherit'],
  env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password), PGSSLMODE: 'verify-full', PGSSLROOTCERT: '/etc/shopsmart/rds-ca.pem' }
});
if (result.error) { console.error('Could not start pg_dump. Check the PostgreSQL client installation.'); process.exitCode = 1; }
else process.exitCode = result.status ?? 1;
