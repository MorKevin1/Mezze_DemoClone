# Mezze

Restaurant management app for tracking menu costs, ingredients, sales, and reports.

## Requirements

- Node.js 20
- npm
- PostgreSQL

## Setup

1. Clone the repo and enter the folder:

```powershell
git clone https://github.com/MorKevin1/Mezze_Demo.git
cd Mezze_Demo
```

2. Copy `.env.example` to `.env` and fill in real values:

- `DATABASE_URL` — a PostgreSQL connection string, for example `postgresql://USER:PASSWORD@localhost:5432/mezze?schema=public`. Create that database first.
- `NEXTAUTH_SECRET` — any long random string. It signs login sessions.
- `NEXTAUTH_URL` — `http://localhost:3000` for a local run.
- `OPENAI_API_KEY` — only needed for photo upload of a menu or an ingredient invoice. Login, menu entry, sales, and reports work without it.

3. Install dependencies and create the tables. There are no migration files, so the schema is applied directly. `.env` has to exist before `npm install`, because that step also runs `prisma generate`.

```powershell
npm install
npx prisma db push
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) and register. Registration creates both the restaurant and the owner account. There is no seed data.
