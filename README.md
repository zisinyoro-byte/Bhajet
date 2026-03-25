# Techmari Budget 💰

A beautiful, full-featured Progressive Web App for personal budget tracking built with Next.js 15, Prisma, and Neon Postgres.

![Techmari Budget](https://img.shields.io/badge/Next.js-15-black) ![Prisma](https://img.shields.io/badge/Prisma-Postgres-blue) ![PWA](https://img.shields.io/badge/PWA-Ready-green)

## ✨ Features

### 💵 Transaction Management
- Add, edit, and delete income/expense transactions
- Categorize with custom categories and emoji icons
- Add notes and receipt images
- Voice input support for quick entry

### 📊 Budget Tracking
- Set monthly budgets per category
- Visual progress bars with over-budget alerts
- Track spending vs. limits at a glance

### 🎯 Savings Goals
- Create savings goals with target amounts
- Track progress with deposits
- Visual progress indicators

### 🔄 Recurring Bills
- Track monthly recurring expenses
- Automatic reminders for due bills
- One-click addition to transactions

### 📈 Analysis
- Expense breakdown by category
- Period filters: All Time, This Month, Last 3 Months
- Visual bar charts

### 🔒 Security
- 4-digit PIN protection
- Secure data storage

### 🌙 User Experience
- Dark mode support
- Multi-currency (USD, EUR, GBP, JPY, INR)
- PWA - Install on mobile/desktop
- Offline support with service worker
- Backup/restore data as JSON

---

## 🚀 Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zisinyoro-byte/Bhajet&env=DATABASE_URL,DIRECT_DATABASE_URL&envDescription=Neon%20Postgres%20connection%20strings&envLink=https://neon.tech)

---

## 📋 Step-by-Step Setup

### 1. Create a Neon Database (Free)

1. Go to [neon.tech](https://neon.tech) and sign up (free)
2. Create a new project called "techmari-budget"
3. Copy your connection strings:
   - **Connection string** → This is your `DATABASE_URL`
   - **Direct connection** → This is your `DIRECT_DATABASE_URL`

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"New Project"**
3. Import from GitHub → Select **`zisinyoro-byte/Bhajet`**
4. Add Environment Variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your Neon connection string (pooled) |
| `DIRECT_DATABASE_URL` | Your Neon direct connection string |

5. Click **"Deploy"**
6. Wait for build to complete (~1-2 minutes)

### 3. Initialize Database

After deployment, run this command locally or in Vercel dashboard terminal:

```bash
npx prisma db push
```

Or the database will auto-initialize on first visit!

---

## 🛠️ Local Development

```bash
# Clone the repository
git clone https://github.com/zisinyoro-byte/Bhajet.git
cd Bhajet

# Install dependencies
bun install

# Create .env file with your Neon credentials
cp .env.example .env
# Edit .env with your DATABASE_URL and DIRECT_DATABASE_URL

# Generate Prisma client and push schema
bun run db:generate
bun run db:push

# Start development server
bun run dev
```

---

## 🔧 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | Neon pooled connection string |
| `DIRECT_DATABASE_URL` | ✅ Yes | Neon direct connection string |

### Example .env

```env
DATABASE_URL="postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
DIRECT_DATABASE_URL="postgresql://username:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

---

## 📱 PWA Installation

1. Open the app in your browser
2. Go to **More → Settings**
3. Click **"📲 Install App"**
4. Add to home screen

---

## 🆓 Free Tier Limits (Neon)

| Resource | Free Tier |
|----------|-----------|
| Storage | 512 MB |
| Compute | 100 hours/month |
| Projects | 1 |
| Auto-suspend | After 5 min inactivity |

This is perfect for personal budget tracking!

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 15 | Full-stack framework |
| React 19 | UI components |
| TypeScript | Type safety |
| Prisma ORM | Database access |
| Neon Postgres | Database (free tier) |
| TanStack Query | Data fetching |
| Tailwind CSS | Styling |

---

## 📄 License

MIT License - Feel free to use and modify!

---

Made with ❤️ by Techmari
