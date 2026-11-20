# ShopSmart Starter Application

ShopSmart is a working educational e-commerce starter for a six-week BSIT full-stack AI application development sequence. It contains a React front end, Express REST API, PostgreSQL database through Prisma, shopping cart, simulated checkout and rule-based product assistant.

The application intentionally leaves several improvements for later lessons. It is for classroom use and must not process real payments or personal customer data.

## Software to install

Install these before setting up ShopSmart:

1. Visual Studio Code: https://code.visualstudio.com/
2. Node.js LTS 22 or newer: https://nodejs.org/
3. Git: https://git-scm.com/downloads
4. PostgreSQL 16 or newer: https://www.postgresql.org/download/
5. Bruno for API testing: https://www.usebruno.com/downloads
6. Google Chrome or Microsoft Edge

During PostgreSQL installation, keep the default port `5432` and record the password assigned to the `postgres` administrator account.

## Windows installation: every step

### A. Install Visual Studio Code

1. Open https://code.visualstudio.com/.
2. Select **Download for Windows**.
3. Run the downloaded installer.
4. Accept the license agreement.
5. Keep the default installation location.
6. Select **Add to PATH**.
7. Select **Add “Open with Code” action** if it is available.
8. Complete the installation and open Visual Studio Code once.

### B. Install Node.js

1. Open https://nodejs.org/.
2. Download the current **LTS** installer. Do not select the Current release.
3. Run the installer.
4. Accept the license agreement.
5. Keep the default components, including npm.
6. Complete the installation.
7. Close and reopen PowerShell.
8. Run:

```powershell
node --version
npm --version
```

Both commands must display version numbers. ShopSmart requires Node.js 20.19 or newer and recommends Node.js 22 LTS.

### C. Install Git

1. Open https://git-scm.com/downloads.
2. Download Git for Windows.
3. Run the installer.
4. Keep the default components.
5. Select Visual Studio Code as Git's default editor if prompted.
6. Keep the recommended command-line and HTTPS options.
7. Complete the installation.
8. Close and reopen PowerShell.
9. Run:

```powershell
git --version
```

### D. Install PostgreSQL

1. Open https://www.postgresql.org/download/windows/.
2. Download the Windows installer.
3. Run the installer as an administrator.
4. Keep **PostgreSQL Server**, **pgAdmin 4**, and **Command Line Tools** selected.
5. Choose an installation directory.
6. Enter and record a password for the `postgres` administrator account.
7. Keep port `5432` unless the instructor specifies another port.
8. Keep the default locale.
9. Complete the installation.
10. Open **SQL Shell (psql)** from the Windows Start menu.
11. Press Enter to accept `localhost`, database `postgres`, port `5432`, and username `postgres`.
12. Enter the PostgreSQL administrator password. The password will not appear while typing.
13. At the `postgres=#` prompt, run these statements one at a time:

```sql
CREATE USER shopsmart_user WITH PASSWORD 'REPLACE_WITH_LOCAL_PASSWORD';
CREATE DATABASE shopsmart OWNER shopsmart_user;
```

14. Confirm that each statement returns `CREATE ROLE` or `CREATE DATABASE`.
15. Type `\q` and press Enter to close SQL Shell.

If PostgreSQL reports that the user or database already exists, do not create another one. Ask the instructor before deleting existing data.

### E. Install Bruno

1. Open https://www.usebruno.com/downloads.
2. Download the Windows installer.
3. Run it and complete the default installation.
4. Open Bruno once to verify it starts.

## Set up the ShopSmart project

### 1. Extract the project

1. Download `ShopSmart-Starter.zip`.
2. Right-click the ZIP file and select **Extract All**.
3. Choose a location that you can write to, such as `Documents\BSIT`.
4. Open the extracted `ShopSmart-Starter` folder.
5. Confirm that `package.json`, `frontend`, `backend`, `docs`, and this `README.md` are visible.

Do not run the project while it remains inside the ZIP archive.

### 2. Open the correct folder in Visual Studio Code

1. Open Visual Studio Code.
2. Select **File > Open Folder**.
3. Select the extracted `ShopSmart-Starter` folder, not only `frontend` or `backend`.
4. If Visual Studio Code asks whether you trust the authors, select **Yes, I trust the authors** only for the instructor-provided copy.
5. Select **Terminal > New Terminal**.
6. Confirm that the terminal path ends in `ShopSmart-Starter`.

### 3. Create the environment files

Run these commands in PowerShell from the project root:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Open `backend/.env`. It should contain:

```env
DATABASE_URL="postgresql://shopsmart_user:REPLACE_WITH_LOCAL_PASSWORD@localhost:5432/shopsmart?schema=public"
PORT=3000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

If the class uses a different database password or port, update only the matching part of `DATABASE_URL`.

Never upload `.env` files or paste their contents into a public repository or AI service.

### 4. Install all project dependencies

From the project root, run:

```powershell
npm install
```

Wait until the command finishes. Do not close the terminal. A `node_modules` folder and `package-lock.json` should appear.

If PowerShell blocks `npm.ps1`, open PowerShell as the current user and run:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Confirm the change, close PowerShell, reopen Visual Studio Code and run `npm install` again.

### 5. Generate the Prisma database client

Run:

```powershell
npm run db:generate
```

The command must finish without an error.

### 6. Create the database tables

Make sure the PostgreSQL service is running. Then run:

```powershell
npm run db:migrate
```

Prisma will connect using `backend/.env` and create the Product, Order and OrderItem tables. The migration command should report that the database is in sync.

### 7. Insert sample products

Run:

```powershell
npm run db:seed
```

The terminal should display:

```text
Seeded 6 ShopSmart products.
```

Running this command again deletes existing classroom orders and restores the six sample products. Do not reseed a database containing work you need to keep.

### 8. Run the automated checks

Run:

```powershell
npm run check
```

This command runs front-end linting, back-end linting, automated tests and the production front-end build. Correct any reported error before continuing.

### 9. Start ShopSmart

Run:

```powershell
npm run dev
```

Keep this terminal open. It runs both applications:

- Front end: http://localhost:5173
- API: http://localhost:3000

### 10. Verify the API

1. Open a browser.
2. Visit http://localhost:3000/api/health.
3. Confirm that the browser displays:

```json
{"status":"ok"}
```

4. Visit http://localhost:3000/api/products.
5. Confirm that the response contains six products.

### 11. Verify the front end

1. Visit http://localhost:5173.
2. Confirm that six product cards appear.
3. Search for `keyboard`.
4. Clear the search.
5. Add a product to the cart.
6. Open the cart and change the quantity.
7. Select **Proceed to checkout**.
8. Create a fictional customer account or sign in when prompted, then enter a delivery address of at least ten characters.
9. Select **Place simulated order**.
10. Confirm that an order number appears.
11. Open **AI Assistant**.
12. Ask `Which keyboard is below ₱2,000?`.
13. Confirm that the response recommends a matching product.

### 12. Stop the application

1. Return to the terminal running `npm run dev`.
2. Press `Ctrl+C`.
3. If PowerShell asks to terminate the batch job, type `Y` and press Enter.

## macOS or Linux differences

After installing Node.js, Git and PostgreSQL, create the database using a PostgreSQL administrator account:

```bash
psql -U postgres
```

Then run:

```sql
CREATE USER shopsmart_user WITH PASSWORD 'REPLACE_WITH_LOCAL_PASSWORD';
CREATE DATABASE shopsmart OWNER shopsmart_user;
\q
```

Create environment files with:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

All remaining npm commands are the same as the Windows instructions.

## Daily startup after the first installation

1. Start PostgreSQL.
2. Open the `ShopSmart-Starter` folder in Visual Studio Code.
3. Open a terminal in the project root.
4. Run `npm run dev`.
5. Open http://localhost:5173.
6. Press `Ctrl+C` when finished.

You do not need to repeat `npm install`, migration or seeding every day.

## Common problems

### `npm` is not recognized

Node.js is missing or the terminal was open during installation. Install Node.js LTS, then completely close and reopen Visual Studio Code.

### Prisma cannot connect to PostgreSQL

Check that PostgreSQL is running and that `DATABASE_URL` uses the correct username, password, port and database name.

### Port 3000 or 5173 is already in use

Stop the previous ShopSmart process with `Ctrl+C`. Do not change ports unless the instructor directs the whole class to update the configuration.

### Products do not appear

Verify http://localhost:3000/api/health and /api/products, check the API terminal, database connection and migrations. Do not reseed existing data to troubleshoot: db:seed deletes orders and products. Seed only an explicitly disposable, empty classroom database.

### The browser reports a CORS error

Confirm that the front end uses http://localhost:5173 and that `FRONTEND_URL=http://localhost:5173` appears in `backend/.env`.

## Project commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install all dependencies |
| `npm run dev` | Run front end and API |
| `npm run check` | Lint, test and build |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Create or update database tables |
| `npm run db:seed` | Reset and insert sample data |
| `npm run db:studio` | Open the Prisma database viewer |

Read `docs/TEACHING_ROADMAP.pdf` for the weekly improvement plan.


## Quality and deployment release (individual activity)

See [release notes](docs/release/RELEASE_NOTES.pdf), [test record](docs/release/TEST_RECORD.pdf), and [deployment plan and diagram](docs/release/DEPLOYMENT_PLAN.pdf). This is a local classroom release; staging has not been deployed.

For an existing database, use `npm run db:generate` then `npm run db:deploy` to apply committed migrations without resetting data. `db:migrate` is for authoring local development migrations. Do not run `db:seed` on data you need to preserve.

Copy `.env.example` files only when the corresponding `.env` does not already exist. Set the public `VITE_API_URL` (including `/api`) in `frontend/.env`; set `DATABASE_URL`, `PORT`, `FRONTEND_URL` and optional `GEMINI_API_KEY` / `GEMINI_MODEL` only in `backend/.env`. Use an approved Gemini model available to your account; provider failure produces a catalog fallback. Restart servers after environment changes; rebuild the frontend after changing `VITE_API_URL`.

The cart is intentionally kept in React memory: navigation preserves it, a browser refresh clears it. Customer registration, sign-in, sign-out, and private order history are available. Checkout requires sign-in. Use fictional information only; online sign-in requires HTTPS. Assistant answers are composed from catalog facts; AI selects matching products but cannot add warranty, shipping or specification claims.

Optional release verification: `npm run test:smoke` runs local Edge browser tests and creates one fictional order; see the release notes before running it. `npm run check:secrets` compares configured server secret values against current submission files and the existing frontend build without displaying the values.

## Customer accounts and private orders

After updating this checkout, stop the API, run `npm run db:generate` and `npm run db:deploy` from the project root, then restart `npm run dev`. Do not run `db:seed` to apply this change.

Choose **Sign in > Create an account instead**. Use fictional details and a password of 12-128 characters. Registration signs you in automatically. Checkout uses the account name and email; the server assigns ownership from the session and ignores supplied customer IDs. **My orders** lists your latest 100 orders; open an order to view its details.

Existing orders are preserved with a null owner and stay inaccessible through customer routes. Matching an old order email does not grant ownership. No account recovery or email verification is included in this classroom feature.

API endpoints:

| Endpoint | Behavior |
| --- | --- |
| POST /api/auth/register | Create account: name, email, password; set session cookie |
| POST /api/auth/login | Sign in: email, password; rotate current session |
| GET /api/auth/me | Current customer; 401 for missing/expired session |
| POST /api/auth/logout | Revoke current session and clear cookie; send JSON {} |
| POST /api/orders | Signed-in checkout: address and items; identity comes from session |
| GET /api/orders | Latest 100 orders belonging to the signed-in customer |
| GET /api/orders/:id | Owner only; 404 for another customer's or unowned order |

Passwords use salted scrypt hashes. Random session tokens are stored as SHA-256 digests in PostgreSQL, expire after seven days, and use HttpOnly, SameSite=Lax cookies. With `NODE_ENV=production`, cookies also require HTTPS and use a __Host- name. Deploy the frontend and API on the same origin (recommended), or the same site; unrelated Amplify and EC2 hostnames will not work with this SameSite policy. Set `FRONTEND_URL` to the exact frontend origin. Browser fetches include credentials. Mutations require JSON and reject foreign origins; cookie-authenticated CLI requests must supply the trusted Origin header too. Account attempts are limited to 20 per IP per 15 minutes; configure trusted proxy handling deliberately when deploying behind a proxy. Expired sessions are refused even if their database rows remain; periodically remove expired rows for long-running deployments.

Verification:

- `npm run check`: lint, password/session and HTTP guest-access tests, existing tests, production build.
- `npm run test:auth:integration`: real PostgreSQL migration and authorization tests in a unique temporary schema, removed afterward. Requires backend/.env DATABASE_URL and database permission to create schemas; use a development database, never a production database.
- `npm run test:auth:browser`: adds headless Edge registration, session reload, sign-out, owner details, direct route refresh, and cross-customer denial. Uses temporary frontend port 5179. Test accounts/orders stay in the temporary schema.
- Existing `npm run test:smoke` now creates a unique fictional customer as well as a simulated order in its target database; it still changes stock. Previous release PDFs/evidence describe the earlier local release and have not been regenerated.

## AWS deployment package

Deployment target: **Asia Pacific (Sydney), ap-southeast-2**, matching the assigned AWS project Region.

Follow [the AWS deployment runbook](deploy/aws/README.md) for account setup, a free DuckDNS hostname, a single CloudFormation stack, native EC2 services and private RDS PostgreSQL, HTTPS, migrations, verification and cleanup. See the updated [AWS deployment plan](docs/release/DEPLOYMENT_PLAN.pdf) and [architecture diagram](docs/release/deployment-diagram.png). The diagram source and infrastructure template are included. Status: prepared locally; not yet deployed or verified on AWS. Earlier release/test PDFs describe the earlier local release.
