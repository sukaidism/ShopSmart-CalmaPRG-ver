# ShopSmart on AWS: EC2 + private RDS PostgreSQL

Prepared 20 November 2026 (Asia/Manila). **Prepared locally; not yet deployed or tested on AWS.**

The simpler workflow is **one CloudFormation stack + one guided setup command**. EC2 runs Caddy, the React build and the Express API. Amazon RDS runs PostgreSQL and manages database backups/maintenance. You do not install a PostgreSQL server or Docker on EC2.

## Architecture and files

- [AWS diagram](../../docs/release/deployment-diagram.png), [deployment PDF](../../docs/release/DEPLOYMENT_PLAN.pdf), [Python diagram source](../../scripts/render-aws-deployment.py), [Mermaid overview](../../docs/release/deployment-diagram.mmd).
- [CloudFormation](infrastructure.json): public EC2 subnet, two private RDS subnets in different Availability Zones, security groups, Single-AZ RDS PostgreSQL 16.15, encrypted storage and an Elastic IP.
- [First-deployment script](setup.sh): installs native runtimes, creates an ordinary application database role, applies migrations, initializes the empty demo catalog, builds the frontend, and starts systemd/Caddy.
- [Update script](update.sh) and [backup helper](backup.cjs).

RDS is **private**. Its port 5432 accepts only the EC2 security group. EC2 exposes HTTPS 443, HTTP 80 for redirect/certificates, and SSH 22 only from your /32. The API listens on 127.0.0.1:3000. The browser never connects directly to RDS. EC2 connects to RDS with verified TLS. One hostname serves the frontend and `/api`, preserving secure session cookies.

Two private subnets are required for the RDS subnet group; **this is still one Single-AZ database**, not a Multi-AZ deployment or standby replica. No NAT gateway, load balancer, Amplify or paid AI provider is required. DNS uses external DuckDNS.

## 1. AWS account and cost check

1. Continue with your existing AWS Free plan project. Confirm its Free plan status, secure your sign-in with MFA where offered, and use your administrative project access for deployment. You do not need to create another account.
2. Record the actual plan, credit balance and expiry in Billing. Eligible new customers receive $100 initially and can earn up to $100 more; the Free plan ends after six months or credit exhaustion. Confirm your account's current terms.
3. Your project is assigned to **Sydney, ap-southeast-2**. Keep deployment resources there; the new project-based console may not show the traditional Region selector. Confirm it through **Manage projects > Project > Overview > Additional Info > Region**. The CloudFormation template automatically uses the current project Region. Verify your account permits CloudFormation, EC2, RDS, VPC, EBS and Elastic IP. Resolve restrictions without silently upgrading.
4. Defaults: **EC2 t3.small**, **RDS db.t4g.micro**, 20 GiB encrypted EC2 gp3 storage and 20 GiB encrypted RDS gp3 storage. Verify eligibility, availability and price before creating. db.t3.micro is an RDS alternative offered by the template. A smaller EC2 t3.micro can struggle during builds.
5. RDS has its own compute/storage/backup usage in addition to EC2. Credits do not make this indefinite free hosting. Public IPv4 is currently $0.005 per IP-hour before applicable benefits. RDS backup retention is one day. Record owner, Region and removal date; review credits daily.

## 2. Create the EC2 key and stack

Commit/push this package and merge it into the intended `main` release first. Do not clone an older commit.

1. In Sydney EC2, create an RSA key pair named `shopsmart-demo` in `.pem` format; keep the private key on your PC, outside Git.
2. Find your PC's current public IPv4. SSH will use `YOUR_PUBLIC_IP/32`, not 0.0.0.0/0 or a private LAN address.
3. Generate a new 64-character hexadecimal RDS administrator password in Windows PowerShell:

```powershell
[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
```

Save it privately in your password manager. It is unrelated to your local development DB password. Do not place it in screenshots, Git, or chat.

4. Open CloudFormation in Sydney. **Create stack > With new resources (standard) > Choose an existing template > Upload a template file**. Upload `deploy/aws/infrastructure.json`.
5. Stack name `shopsmart-demo`. Set:

| Parameter | Value |
| --- | --- |
| KeyName | shopsmart-demo |
| AdminCidr | Your current public IPv4 /32 |
| InstanceType | t3.small |
| DatabaseInstanceClass | db.t4g.micro, if eligible/available |
| DatabasePassword | The saved 64-character hex password; this parameter is masked with NoEcho |
| UbuntuAmi | Leave the Ubuntu 24.04 x86_64 default |

6. Review resources/costs and create the stack. Wait for **CREATE_COMPLETE**; RDS provisioning can take several minutes. On failure inspect Events before retrying.
7. Copy **PublicIPv4**, **DatabaseEndpoint**, and **DatabaseIdentifier** from Outputs. The template creates both services; do not also create an RDS instance manually.

The RDS administrator is `shopsmart_admin`. Setup uses it once to create a separate ordinary `shopsmart` role for Prisma/app queries. The master password is not saved on EC2. CloudFormation's password parameter is hidden from normal parameter displays, but this does not replace keeping it private.

## 3. Get the free hostname

Sign in to [DuckDNS](https://www.duckdns.org/), reserve an available subdomain, and explicitly set its IPv4 to the stack's **PublicIPv4**. Do not accept your PC's IP by mistake. A sample hostname is `shopsmart-yourname.duckdns.org`; the example is not assigned to you. Keep DuckDNS tokens private; none are needed on EC2.

Check from Windows:

```powershell
Resolve-DnsName shopsmart-yourname.duckdns.org -Type A
```

The result must equal PublicIPv4. Remove an unrelated AAAA record if present; this stack is IPv4-only. DuckDNS is a third-party free service; you may use a domain/subdomain you control instead. Caddy obtains the HTTPS certificate once DNS and ports 80/443 are correct.

## 4. Connect, clone, and run one setup command

From Windows:

```powershell
ssh -i "C:\Users\YOUR_NAME\Downloads\shopsmart-demo.pem" ubuntu@YOUR_ELASTIC_IP
```

If SSH times out, check instance status and whether AdminCidr still matches your IP. Update that stack parameter if needed. Restrict private-key file permissions to your Windows user if SSH rejects them.

On Ubuntu over SSH:

```bash
sudo cloud-init status --wait
sudo apt-get update
sudo apt-get install -y git
sudo git clone --branch main https://github.com/sukaidism/ShopSmart-CalmaPRG-ver.git /opt/shopsmart
sudo chown -R ubuntu:ubuntu /opt/shopsmart
cd /opt/shopsmart
git rev-parse HEAD
sudo bash deploy/aws/setup.sh
```

The script asks for only:

- Your public hostname (no `https://` or slash).
- Your certificate contact email.
- `DatabaseEndpoint` from the stack outputs.
- The RDS administrator password you supplied to CloudFormation; input is hidden.

It installs Node 22 from its official archive with a SHA-256 check, Caddy from its official apt repository and PostgreSQL **client tools only**. It downloads the AWS RDS CA bundle, verifies the private DB connection, generates a distinct app-role password, creates protected settings outside the repository, runs committed migrations and the guarded empty-database initializer, builds with `VITE_API_URL=/api`, and starts the API/Caddy systemd services. Gemini is left blank for the labeled catalog fallback.

This script is **first-deployment only**. It refuses to overwrite `/etc/shopsmart/backend.env`. If setup fails, inspect the reported step before retrying: a created DB role or settings file may already exist. Do not delete the database or rerun the destructive original seed to troubleshoot. Use the update script only after first setup has completed; incomplete initial migrations/seeding may need to be finished with `run-backend.sh` after correcting the failure.

Files created on EC2:

| Location | Purpose |
| --- | --- |
| /etc/shopsmart/backend.env | App DB URL with strict TLS, production session settings, optional provider key; root:shopsmart 640 |
| /etc/shopsmart/rds-ca.pem | AWS RDS CA bundle |
| /etc/caddy/shopsmart.env | Public hostname/certificate email; root:caddy 640 |
| /srv/shopsmart | Production frontend files |
| shopsmart.service | Restricted API identity, local port 3000, restart on failure/boot |
| caddy.service | Public HTTPS/static files and local API proxy |

Do not publish these server settings. No secret belongs in `VITE_` configuration. The API's DB URL uses Prisma 6 parameters `sslmode=require`, `sslcert`, and `sslaccept=strict`; libpq tools instead use `sslmode=verify-full` with the CA bundle. Do not disable certificate validation.

## 5. Verify the real release

From Windows:

```powershell
curl.exe -I https://shopsmart-yourname.duckdns.org
curl.exe https://shopsmart-yourname.duckdns.org/api/health
curl.exe https://shopsmart-yourname.duckdns.org/api/products
```

On EC2:

```bash
sudo systemctl status shopsmart caddy --no-pager
sudo journalctl -u shopsmart -n 80 --no-pager
sudo journalctl -u caddy -n 80 --no-pager
sudo ss -ltnp
```

There should be no PostgreSQL server listening on EC2. Port 3000 must be loopback-only; 80/443 are public. RDS console must show **Publicly accessible: No**, with 5432 allowed from the EC2 security group only.

Use fictional data in a fresh browser:

- Load/search products, use cart quantities/totals, and refresh nested React routes directly.
- Guest checkout requires sign-in; direct `GET /api/orders` returns 401.
- Register A and complete simulated checkout. Verify saved order details and stock changes.
- Sign out and register B. A direct request for A's order must return 404 with no private data.
- Verify assistant product facts/links and the fallback label with no provider key.
- Confirm all browser requests use the same HTTPS host under `/api` and secure session cookies; do not screenshot cookie values.
- Reboot EC2 with `sudo reboot`, then verify services and the saved order. RDS data is independent of the EC2 disk.

Health alone tests the API process; products/checkout test the RDS path. Record actual URL, Region, commit SHA, resource IDs, plan/credits/expiry, redacted evidence, and the exam's two improvements/retests. Local tests and green stack status do not prove a hosted release.

## 6. Backups and updates

RDS automated backups retain one day. For a release update, also take a manual RDS snapshot in the console and/or download a logical backup. Snapshot storage may consume credits separately.

To create a logical backup as the Ubuntu user:

```bash
cd /opt/shopsmart
umask 077
mkdir -p ~/shopsmart-backups
sudo -u shopsmart bash deploy/aws/run-backend.sh /usr/local/bin/node ../deploy/aws/backup.cjs > ~/shopsmart-backups/shopsmart-before-update.dump
pg_restore --list ~/shopsmart-backups/shopsmart-before-update.dump > /dev/null
```

Copy it privately to your PC with SCP. Do not commit it. Archive listing checks readability; rehearse restoration into a disposable database for stronger evidence.

For subsequent releases, back up and record the old SHA first:

```bash
cd /opt/shopsmart
git rev-parse HEAD
git pull --ff-only origin main
sudo bash deploy/aws/update.sh
```

The update script stops public app access, installs dependencies, runs committed migrations, rebuilds static files and restarts services. It never reseeds or changes RDS passwords. Review/reinstall changed Caddy settings as needed. On failure, keep public services stopped and inspect logs; a code rollback does not undo a DB migration. RDS password rotations must be coordinated with the app role and its protected settings.

## 7. Cleanup

1. Export required evidence and a private backup first.
2. Delete the CloudFormation stack when the demo ends. It terminates EC2/deletes its root EBS, releases the Elastic IP, and **takes a final RDS snapshot before deleting the DB**. Deletion protection is disabled for this classroom cleanup path.
3. Inspect stack Events and the RDS console if deletion fails. A snapshot does not count as a live database but can still consume storage credits.
4. Review the final snapshot, manual snapshots, retained automated backups, and any separately created volumes/resources. Delete unneeded snapshots only after confirming you have the required backup; otherwise they can continue to consume credits.
5. Remove/update DuckDNS after releasing the IP, and check Billing. Stopping EC2 alone leaves RDS running and does not complete cleanup.

## Troubleshooting

| Failure | Check |
| --- | --- |
| Stack/RDS fails | Events, RDS plan eligibility, class/engine availability, subnet/AZ availability |
| DB connection timeout | Actual DatabaseEndpoint, RDS available, same VPC, DB SG source is EC2 SG; keep RDS private |
| DB login/TLS fails | Correct administrator password, CA bundle, actual RDS hostname; keep TLS verification enabled |
| Setup says role/settings exist | Prior run partly completed; inspect that stage, do not reset existing data |
| API fails | `journalctl -u shopsmart`, app-role permissions, strict-TLS DB URL, migrations |
| HTTPS fails | DuckDNS A/AAAA, hostname, 80/443 and `journalctl -u caddy` |
| Login does not persist | Same HTTPS hostname, FRONTEND_URL, Secure cookie; avoid HTTP/IP login |

## Regenerate diagram and plan

```bash
python -m pip install -r deploy/aws/diagram-requirements.txt
python scripts/render-aws-deployment.py
```

Diagram source does not deploy resources. CloudFormation and native setup still need real-account/EC2 verification. No AWS resources were created during local preparation.

References: [AWS RDS Free Tier](https://aws.amazon.com/rds/free/), [RDS PostgreSQL versions](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.DBVersions.html), [RDS TLS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html), [CloudFormation RDS](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-rds-dbinstance.html), [Prisma 6 PostgreSQL TLS](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql), [Caddy installation](https://caddyserver.com/docs/install), [DuckDNS](https://www.duckdns.org/).
