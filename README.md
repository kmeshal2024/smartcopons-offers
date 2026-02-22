# SmartCopons App

A complete production-ready coupons and deals management platform built with Next.js 14 (App Router), Prisma ORM, and MySQL. Designed specifically for deployment on Hostinger Business Web Hosting.

## Features

### Public Features
- ✅ Homepage with latest coupons
- ✅ Search functionality (client-side)
- ✅ Store pages with all coupons
- ✅ Individual coupon detail pages
- ✅ Arabic RTL support
- ✅ Responsive design with Tailwind CSS

### Admin Features
- ✅ Secure login with bcrypt password hashing
- ✅ Session-based authentication (HTTP-only cookies)
- ✅ Full CRUD for Coupons
- ✅ Full CRUD for Stores
- ✅ Protected admin routes

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** MySQL
- **ORM:** Prisma
- **Authentication:** bcryptjs + secure sessions
- **Validation:** Zod
- **Styling:** Tailwind CSS
- **TypeScript:** Full type safety

## Prerequisites

- Node.js 18.x or 20.x
- MySQL database
- Hostinger Business Web Hosting (or similar Node.js hosting)

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd smartcopons-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Database
DATABASE_URL="mysql://root:password@localhost:3306/smartcopons"

# App Security (generate a random 32+ character string)
APP_SECRET="your-super-secret-random-string-at-least-32-chars"

# Admin Account
ADMIN_EMAIL="admin@smartcopons.com"
ADMIN_PASSWORD="YourSecurePassword123!"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Setup Database

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed the database
npx prisma db seed
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see your app!

Login to admin at: `http://localhost:3000/admin/login`

## Hostinger Deployment Guide

### Prerequisites on Hostinger

1. **Hostinger Business Plan** (or higher with Node.js support)
2. **MySQL Database** created via hPanel
3. **SSH Access** enabled

### Step 1: Prepare Your MySQL Database

1. Login to **hPanel** → Advanced → MySQL Databases
2. Create a new database:
   - Database name: `u123456_smartcopons` (Hostinger adds prefix)
3. Create a database user and add to database with ALL PRIVILEGES
4. Note your credentials:
   ```
   Host: localhost
   Database: u123456_smartcopons
   Username: u123456_smartcopons_user
   Password: [your password]
   ```

### Step 2: Upload Your Code

**Option A: Via Git (Recommended)**

1. SSH into your Hostinger account:
   ```bash
   ssh u123456@yourdomain.com -p 65002
   ```

2. Navigate to your domain directory:
   ```bash
   cd domains/sa.smartcopons.com/public_html
   ```

3. Clone your repository:
   ```bash
   git clone https://github.com/yourusername/smartcopons-app.git .
   ```

**Option B: Via File Manager/FTP**

1. Zip your project locally (exclude `node_modules`)
2. Upload via hPanel File Manager or FTP client
3. Extract in `domains/sa.smartcopons.com/public_html`

### Step 3: Setup Environment Variables

1. Create `.env` file in your project root:

```bash
nano .env
```

2. Add your production configuration:

```env
# Use your actual Hostinger MySQL credentials
DATABASE_URL="mysql://u123456_smartcopons_user:YOUR_PASSWORD@localhost:3306/u123456_smartcopons"

# Generate a secure random string
APP_SECRET="your-super-secret-random-string-at-least-32-chars-change-this"

# Your admin credentials
ADMIN_EMAIL="admin@smartcopons.com"
ADMIN_PASSWORD="YourSecurePassword123!"

# Your production URL
NEXT_PUBLIC_APP_URL="https://sa.smartcopons.com"
```

### Step 4: Install Dependencies and Build

```bash
# Install dependencies
npm install

# This will also run 'prisma generate' (via postinstall script)

# Run database migrations
npx prisma migrate deploy

# Seed the database with sample data
npx prisma db seed

# Build the Next.js app
npm run build
```

### Step 5: Setup Node.js App in Hostinger

**Method A: Using Hostinger Node.js App Manager (If Available)**

1. Go to hPanel → Advanced → Node.js
2. Create New Application:
   - **Application Root:** `/domains/sa.smartcopons.com/public_html`
   - **Application URL:** `sa.smartcopons.com`
   - **Node.js Version:** 20.x (or 18.x)
   - **Application Mode:** Production
   - **Environment Variables:** Add all variables from `.env`

3. In the "Run Script" section:
   - **Start Command:** `npm start`

4. Click "Create"

**Method B: Manual Setup via PM2 (If Node.js Manager Not Available)**

1. Install PM2 globally:
   ```bash
   npm install -g pm2
   ```

2. Start your app:
   ```bash
   pm2 start npm --name "smartcopons" -- start
   ```

3. Save PM2 process list:
   ```bash
   pm2 save
   pm2 startup
   ```

4. Check status:
   ```bash
   pm2 status
   pm2 logs smartcopons
   ```

### Step 6: Configure Web Server

If using PM2, you need to proxy requests to your Node.js app.

Create `.htaccess` in your public_html:

```apache
RewriteEngine On
RewriteBase /

# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Proxy to Node.js app (change port if needed)
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]
```

**Note:** Find your Node.js port with:
```bash
netstat -tuln | grep node
```

### Step 7: SSL Certificate

1. Go to hPanel → Advanced → SSL
2. Select your domain `sa.smartcopons.com`
3. Install Let's Encrypt SSL (Free)
4. Wait 10-15 minutes for activation

### Step 8: Test Your Deployment

1. Visit `https://sa.smartcopons.com`
2. You should see the homepage with coupons
3. Login at `https://sa.smartcopons.com/admin/login`
   - Use credentials from your `.env` file

## Troubleshooting

### App Keeps Stopping

Create a restart script:

```bash
nano ~/restart-smartcopons.sh
```

```bash
#!/bin/bash
cd /home/u123456/domains/sa.smartcopons.com/public_html
pm2 restart smartcopons || pm2 start npm --name "smartcopons" -- start
```

```bash
chmod +x ~/restart-smartcopons.sh
```

Add to cron (every 10 minutes):
```bash
crontab -e
```

Add this line:
```
*/10 * * * * ~/restart-smartcopons.sh
```

### Database Connection Error

1. Verify DATABASE_URL in `.env`
2. Use `localhost` as host (not `127.0.0.1`)
3. Check database name includes Hostinger prefix
4. Verify user has ALL PRIVILEGES

### Port Already in Use

Change port in package.json start script:
```json
"start": "next start -p 3001"
```

Or set PORT environment variable:
```bash
export PORT=3001
npm start
```

### Build Fails

1. Check Node.js version: `node -v` (should be 18+)
2. Clear cache: `rm -rf .next node_modules package-lock.json`
3. Reinstall: `npm install`
4. Rebuild: `npm run build`

## Getting Coupon Data from smartcopons.com

**TODO:** Implement data scraping/import functionality

Current approach for manual import:
1. Login to admin panel
2. Go to "Stores" and add your stores
3. Go to "Coupons" and add coupons manually

**Future Enhancement:**
- Create import script to fetch coupons from smartcopons.com
- Add API endpoint for bulk coupon import
- Schedule automated updates

## Project Structure

```
smartcopons-app/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Homepage
│   ├── layout.tsx         # Root layout
│   ├── globals.css        # Global styles
│   ├── store/[slug]/      # Store pages
│   ├── coupon/[id]/       # Coupon detail pages
│   ├── admin/             # Admin panel
│   │   ├── login/         # Admin login
│   │   ├── coupons/       # Coupons CRUD
│   │   └── stores/        # Stores CRUD
│   └── api/               # API routes
│       ├── auth/          # Authentication
│       ├── admin/         # Admin APIs
│       └── public/        # Public APIs
├── components/            # React components
├── lib/                   # Utility functions
│   ├── db.ts             # Prisma client
│   ├── auth.ts           # Authentication
│   └── validators.ts     # Zod schemas
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Seed data
├── middleware.ts         # Route protection
└── package.json
```

## API Endpoints

### Public APIs
- `GET /api/public/coupons` - Get all active coupons
- `GET /api/public/stores/[slug]` - Get store and its coupons

### Admin APIs (Require Authentication)
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `GET /api/admin/coupons` - List all coupons
- `POST /api/admin/coupons` - Create coupon
- `PUT /api/admin/coupons/[id]` - Update coupon
- `DELETE /api/admin/coupons/[id]` - Delete coupon
- `GET /api/admin/stores` - List all stores
- `POST /api/admin/stores` - Create store
- `PUT /api/admin/stores/[id]` - Update store
- `DELETE /api/admin/stores/[id]` - Delete store

## Security

- ✅ Passwords hashed with bcryptjs (10 rounds)
- ✅ Session tokens signed with HMAC-SHA256
- ✅ HTTP-only cookies (prevent XSS)
- ✅ Secure cookies in production (HTTPS only)
- ✅ Session expiry (7 days)
- ✅ Protected admin routes via middleware
- ✅ Input validation with Zod

## Performance

- ✅ Server-side rendering for SEO
- ✅ Client-side search (no server load)
- ✅ Optimized database queries with Prisma
- ✅ Tailwind CSS for minimal bundle size

## Support

For issues related to:
- **Hosting:** Contact Hostinger support
- **Code:** Open an issue on GitHub
- **Database:** Check Prisma documentation

## License

Private - All rights reserved

## Credits

Built with:
- Next.js 14
- Prisma ORM
- Tailwind CSS
- bcryptjs
- Zod
