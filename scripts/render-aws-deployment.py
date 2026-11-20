"""Generate the planned AWS diagram and deployment plan. Does not access AWS.
Run from repository root: python scripts/render-aws-deployment.py
Dependencies: Pillow, ReportLab. Four AWS icon assets are bundled with attribution.
"""
from pathlib import Path
import shutil
from PIL import Image, ImageDraw, ImageFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as PdfImage, PageBreak, Table, TableStyle, KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import landscape, A4

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs/release'
OUT = ROOT / 'output/pdf'
OUT.mkdir(parents=True, exist_ok=True)
INK = '#152033'
MUTED = '#58677a'
TEAL = '#0f766e'
ORANGE = '#ed7100'
PURPLE = '#7c3aed'


def font(size, bold=False):
    names = ['C:/Windows/Fonts/arialbd.ttf' if bold else 'C:/Windows/Fonts/arial.ttf',
             '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
    for name in names:
        if Path(name).exists():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default(size=size)


def diagram():
    # Conventional AWS architecture notation: square group boundaries, icons,
    # dashed AZ/security boundaries, and subnet shading on a white canvas.
    im = Image.new('RGB', (1800, 1180), 'white')
    d = ImageDraw.Draw(im)
    green, blue, orange, gray = '#00a63c', '#0073bb', '#d86613', '#545b64'
    def text(x, y, value, size=23, fill=gray, bold=False):
        d.multiline_text((x, y), value, font=font(size, bold), fill=fill, spacing=7)
    def center(x, y, value, size=23, fill=gray, bold=False):
        for line in value.split('\n'):
            w=d.textlength(line,font=font(size,bold))
            text(x-w/2,y,line,size,fill,bold); y += size+8
    def icon(name, x, y, size=76):
        asset=Image.open(DOCS/'aws-icons'/(name+'.png')).convert('RGBA')
        asset.thumbnail((size,size)); im.paste(asset,(x,y),asset)
    def dashed_line(a,b,color=blue,width=2,dash=10):
        x1,y1=a; x2,y2=b
        length=((x2-x1)**2+(y2-y1)**2)**.5
        if not length: return
        for n in range(0,int(length),dash+6):
            k=min(n+dash,length)
            d.line([(x1+(x2-x1)*n/length,y1+(y2-y1)*n/length),(x1+(x2-x1)*k/length,y1+(y2-y1)*k/length)],fill=color,width=width)
    def boundary(bounds,color,width=2,dashed=False):
        x1,y1,x2,y2=bounds
        if dashed:
            for a,b in [((x1,y1),(x2,y1)),((x2,y1),(x2,y2)),((x2,y2),(x1,y2)),((x1,y2),(x1,y1))]: dashed_line(a,b,color,width)
        else: d.rectangle(bounds,outline=color,width=width)
    def arrow(points,color=gray,dashed=False):
        for a,b in zip(points,points[1:]):
            if dashed: dashed_line(a,b,color,2,8)
            else: d.line([a,b],fill=color,width=3)
        x,y=points[-1]; px,py=points[-2]
        if x>px: tip=[(x,y),(x-11,y-6),(x-11,y+6)]
        elif x<px: tip=[(x,y),(x+11,y-6),(x+11,y+6)]
        elif y>py: tip=[(x,y),(x-6,y-11),(x+6,y-11)]
        else: tip=[(x,y),(x-6,y+11),(x+6,y+11)]
        d.polygon(tip,fill=color)
    text(35,25,'ShopSmart - EC2 + RDS architecture',27,bold=True)
    text(35,66,'Planned native application + managed PostgreSQL',20)
    center(1020,35,'Gemini (optional)',23)
    boundary((310,110,1770,1070),'#232f3e',3)
    text(340,135,'AWS Cloud',28,'#232f3e')
    text(1360,140,'Sydney / ap-southeast-2',21)
    boundary((490,210,1730,1030),green,3)
    icon('vpc',505,222,52)
    text(575,235,'ShopSmart VPC - 10.50.0.0/16',25,green)
    boundary((545,320,1310,975),blue,2,True)
    boundary((1350,320,1690,975),blue,2,True)
    text(570,340,'Availability Zone 1',23,blue)
    text(1370,340,'Availability Zone 2',22,blue)
    # Public application subnet, with native services on EC2.
    d.rectangle((580,400,1275,665),fill='#e4eed4')
    icon('public-subnet',580,400,48)
    text(650,413,'Public subnet - 10.50.1.0/24',23,green)
    boundary((620,465,1245,645),orange,2,True)
    text(635,478,'EC2 security group',19,orange)
    icon('ec2',865,510,76)
    text(970,505,'Amazon EC2 - t3.small',21)
    text(970,540,'Caddy + Node.js / Express',19)
    text(970,572,'systemd / local API 3000',18)
    icon('ebs',650,560,43)
    text(705,583,'20 GiB encrypted EBS',16)
    # Two private subnets satisfy RDS subnet-group requirements; only A hosts the DB.
    d.rectangle((580,750,1275,950),fill='#d0eaf2')
    d.rectangle((1380,750,1660,950),fill='#d0eaf2')
    text(600,766,'Private DB subnet A',21,blue)
    text(1000,766,'10.50.10.0/24',19,blue)
    text(1395,766,'Private DB subnet B',20,blue)
    text(1395,800,'10.50.11.0/24',18)
    boundary((620,810,1245,932),orange,2,True)
    icon('rds-postgresql',865,825,76)
    text(970,818,'Amazon RDS PostgreSQL 16',20)
    text(970,850,'Single-AZ / db.t4g.micro',19)
    text(970,881,'20 GiB encrypted storage',18)
    text(1395,850,'DB subnet group',19)
    text(1395,883,'No standby instance',18)
    # Customer and DNS ingress remain outside the VPC.
    icon('internet-gateway',455,515,68)
    center(420,610,'Internet\ngateway',20)
    center(420,678,'Elastic IP',19)
    icon('users',86,510,85)
    center(125,610,'Customers',23)
    arrow([(185,555),(455,555)])
    text(230,521,'HTTPS 443',18)
    arrow([(523,555),(865,555)])
    text(695,523,'HTTPS',18)
    icon('client',90,245,70)
    center(125,335,'DuckDNS',23)
    center(125,370,'External DNS',19)
    arrow([(180,305),(400,305),(400,515),(455,515)],gray,True)
    text(235,325,'A record',18)
    icon('server',85,830,80)
    center(125,930,'Administrator',23)
    arrow([(190,875),(365,875),(365,580),(455,580)])
    text(230,840,'SSH 22',19)
    text(55,975,'Trusted public IPv4 /32',18)
    # App-to-database traffic is private and encrypted.
    arrow([(902,586),(902,825)])
    text(925,698,'TLS / PostgreSQL 5432',19)
    text(600,997,'RDS security group: allow 5432 only from EC2 security group. No public DB endpoint.',19)
    arrow([(902,510),(902,450),(1287,450),(1287,90),(1020,90),(1020,75)],'#7b61a8',True)
    text(1305,175,'Outbound HTTPS',18,'#7b61a8')
    text(35,1100,'20 November 2026 | Planned, not deployed | One EC2 application server + private Single-AZ RDS PostgreSQL.',21)
    text(35,1140,'Two private subnets do not mean Multi-AZ replication. RDS backups/final snapshots require separate cleanup.',19)
    target=DOCS/'deployment-diagram.png'
    im.save(target)
    return target


def plan(png):
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='PlanTitle', fontName='Helvetica-Bold', fontSize=23, leading=29, textColor=colors.HexColor(INK), spaceAfter=12))
    styles.add(ParagraphStyle(name='PlanBody', fontName='Helvetica', fontSize=10, leading=15, textColor=colors.HexColor(INK), spaceAfter=10))
    styles.add(ParagraphStyle(name='PlanHeading', fontName='Helvetica-Bold', fontSize=14, leading=18, textColor=colors.HexColor(TEAL), spaceBefore=12, spaceAfter=9))
    styles.add(ParagraphStyle(name='SmallPlan', fontName='Helvetica', fontSize=8, leading=12, textColor=colors.HexColor(MUTED), spaceAfter=8))
    pdf = OUT / 'DEPLOYMENT_PLAN.pdf'
    width, height = landscape(A4)
    doc = SimpleDocTemplate(str(pdf), pagesize=(width,height), rightMargin=36,leftMargin=36,topMargin=30,bottomMargin=36,title='ShopSmart AWS Deployment Plan',author='Paul Richard Calma')
    story=[]
    def p(txt, style='PlanBody'): story.append(Paragraph(txt,styles[style]))
    def heading(txt): p(txt,'PlanHeading')
    def table(rows, widths):
        data=[[Paragraph(str(c),styles['SmallPlan']) for c in row] for row in rows]
        t=Table(data,colWidths=widths,hAlign='LEFT')
        t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e6fffb')),('GRID',(0,0),(-1,-1),.5,colors.HexColor('#dce3eb')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
        story.append(t)
    p('ShopSmart | AWS deployment plan','PlanTitle')
    p('Paul Richard Calma | 20 November 2026 (Asia/Manila) | PLANNED - NOT DEPLOYED','SmallPlan')
    story.append(PdfImage(str(png),width=660,height=433))
    story.append(PageBreak())
    p('Architecture decisions and trust boundaries','PlanTitle')
    p('Decision: use the instructor-permitted EC2 plus managed RDS layout for a short fictional-data demonstration. Ubuntu EC2 runs Caddy, the frontend build and Express. Private Amazon RDS runs PostgreSQL 16. A free DuckDNS subdomain points to an Elastic IP. Caddy provides browser-trusted HTTPS; no domain purchase is required.')
    table([['Part','Chosen implementation','Boundary / persistence'],['AWS infrastructure','Dedicated VPC, public EC2 subnet, two private RDS subnets, internet gateway and separate security groups; Sydney ap-southeast-2','CloudFormation: deploy/aws/infrastructure.json. Verify this Region and the services are eligible for the actual account.'],['Compute / frontend','t3.small, Ubuntu 24.04 x86_64; Caddy + Vite build','Public TCP 443; TCP 80 redirect/certificate challenges. VITE_API_URL=/api; direct React routes fall back to index.html.'],['API / identity','Node 22 + Express, internal TCP 3000','The API binds to 127.0.0.1; only local Caddy/admin processes reach it. Same-origin Secure/HttpOnly sessions, password hashing, server-derived order owner, owner-filtered reads.'],['Database / storage','Private RDS PostgreSQL 16, db.t4g.micro, Single-AZ; encrypted 20 GiB gp3 storage','Database is not publicly accessible. Port 5432 allows only the EC2 security group; verified TLS is required. Backups retain one day; final snapshot on stack deletion.'],['Provider / DNS','Optional external Gemini; external DuckDNS hostname','Public catalog facts + question only to Gemini over HTTPS. DuckDNS tokens, DB password, keys and session tokens stay private.']],[112,275,383])
    heading('Limitations and honest release status')
    p('The EC2 application server and Single-AZ RDS database are not highly available. The second private subnet is a subnet-group requirement, not a standby. There is no Amplify, NAT gateway or load balancer. Native Linux installation/service startup, public DNS/certificate issuance and the hosted user journey have not yet been verified. The existing local checks are not evidence of an AWS release.')
    story.append(PageBreak())
    p('First deployment: exact sequence','PlanTitle')
    for title,body in [
      ('1. Account and cost ownership','Use the existing AWS Free plan project assigned to Sydney (ap-southeast-2). Confirm the Region in AWS Settings; no manual Region switch is required. Secure the account and use administrative project access. Record plan, credits/expiry, Region, resource owner and removal date. The current new-customer plan offers $100 initial credits and up to $100 more, for at most six months or credit exhaustion. Verify the console terms.'),
      ('2. Infrastructure as code','Push/merge the deployment files first. Create an RSA .pem EC2 key pair in Sydney. Upload deploy/aws/infrastructure.json in CloudFormation; use a name such as shopsmart-demo, the key name and your current public IPv4 /32. Review costs before creating. Supply the masked 64-hex database password. Record PublicIPv4 and DatabaseEndpoint from Outputs after CREATE_COMPLETE.'),
      ('3. Free hostname and SSH','Reserve an available DuckDNS subdomain and explicitly set its A record to the stack Elastic IP, not your PC IP. Verify DNS with Resolve-DnsName. SSH from Windows with the private key as ubuntu@PUBLIC_IP. Keep SSH limited to your /32.'),
      ('4. Install and configure','Clone the intended main commit, record its SHA, and run sudo bash deploy/aws/setup.sh; enter the hostname, contact email, RDS endpoint and saved administrator password. CloudFormation creates the private RDS database and returns its endpoint. Keep the masked administrator password private. Do not copy local .env or publish secrets.'),
      ('5. Build and initialize','The setup script installs native runtimes and the RDS CA, creates a separate app DB role, writes protected settings, runs migrations and guarded initialization, builds the frontend and starts services. Master credentials are not saved on EC2. Never run the destructive original seed on deployed data.'),
      ('6. TLS and acceptance','Confirm database/API health and successful migration logs; allow Caddy to issue the certificate. Then test the real HTTPS hostname and API, registration, checkout, order ownership, assistant fallback and restart persistence. Record redacted evidence before describing the release as hosted.')]:
        heading(title); p(body)
    p('The complete copyable Windows/Ubuntu commands, settings, troubleshooting and current official sources are in deploy/aws/README.md.','SmallPlan')
    story.append(PageBreak())
    p('Verification, operations and cleanup','PlanTitle')
    table([['Hosted check','Expected observation'],['Frontend and routing','Trusted HTTPS; direct /assistant, /cart and product URL refreshes show the app. All API requests use the same hostname under /api.'],['Database and cart','Products load, stock limits hold, quantities and totals are correct. /api/health alone does not test the database.'],['Customer A / checkout','Register fictional A, place a valid simulated order, open private details. Server assigns ownership from the session. Invalid/excess stock is rejected.'],['Guest / customer B','Guest order requests return 401; B requesting A\'s order gets 404 and no private data. Sign-out revokes the session.'],['Assistant','Claims/links match the current catalog. With no provider key, the verified catalog fallback is clearly identified.'],['Restart and evidence','Reboot EC2; systemd services restart and the order persists. Record site URL, Region, commit SHA, plan/credits, redacted logs/screenshots and the exam\'s two improvements/retests.']],[180,590])
    heading('Updates and preservation')
    p('Before updating, create a pg_dump custom-format backup and securely copy it off-instance. Stop Caddy and the API systemd service, pull the intended commit, rebuild, run the committed Prisma migrations, then restart. Do not rerun initial seeding. Keep the previous code SHA, the previous code version and a tested database restore path for deliberate rollback.')
    heading('Costs and removal')
    p('EC2, RDS compute/storage/backups, EBS and IPv4 consume credits; this is not indefinite free hosting. Public IPv4 is currently $0.005 per IP-hour before applicable benefits. Monitor actual credits. After exporting evidence and backup, delete the CloudFormation stack and inspect remaining instances, volumes, Elastic IPs and any separately created snapshots. Stack deletion removes EC2 and RDS, taking a final RDS snapshot first. Retained snapshots can continue to consume storage credits until separately deleted. Remove/update DuckDNS after releasing the address.')
    p('Reference sources: aws.amazon.com/free/ ; docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html ; aws.amazon.com/vpc/pricing/ ; aws.amazon.com/rds/free/ ; caddyserver.com/docs/automatic-https ; duckdns.org. Full clickable links are in the runbook.','SmallPlan')
    def footer(canvas, doc):
        canvas.setStrokeColor(colors.HexColor('#dce3eb')); canvas.line(36,28,width-36,28)
        canvas.setFont('Helvetica',8); canvas.setFillColor(colors.HexColor(MUTED))
        canvas.drawString(36,16,'SHOPSMART | AWS DEPLOYMENT PLAN | PREPARED, NOT DEPLOYED')
        canvas.drawRightString(width-36,16,str(doc.page))
    doc.build(story,onFirstPage=footer,onLaterPages=footer)
    shutil.copyfile(pdf,DOCS/'DEPLOYMENT_PLAN.pdf')
    return pdf


if __name__ == '__main__':
    image=diagram(); pdf=plan(image)
    print('Created:', image.relative_to(ROOT))
    print('Created:', pdf.relative_to(ROOT))
    print('Updated: docs/release/DEPLOYMENT_PLAN.pdf')
