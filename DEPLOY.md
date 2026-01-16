# Deploying WikiGuessr to Vercel (Free)

## Quick Deploy via Web Interface (Easiest)

1. **Push to GitHub** (if not already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Go to Vercel Dashboard**: https://vercel.com/new

3. **Import your GitHub repository**

4. **Add Environment Variables** in Vercel project settings:
   - `DATABASE_URL` - Get from Vercel Postgres (see below) or Neon.tech (free)
   - `REDIS_URL` - Get from Upstash Redis (free) - Optional but recommended
   
5. **Configure Build Settings**:
   - Framework Preset: **Next.js**
   - Build Command: `prisma generate && next build`
   - Output Directory: `.next` (default)

6. **Deploy!** Vercel will automatically detect Next.js and deploy.

---

## Setting Up Free Databases

### Option 1: Vercel Postgres (Recommended)
1. In your Vercel project → **Storage** tab
2. Click **Create Database** → **Postgres**
3. Copy the `POSTGRES_PRISMA_URL` or `POSTGRES_URL_NON_POOLING`
4. Use it as `DATABASE_URL` in environment variables
5. Run migrations: `npx prisma migrate deploy` (Vercel will do this on deploy)

### Option 2: Neon.tech (Free PostgreSQL)
1. Go to https://neon.tech and sign up
2. Create a new project
3. Copy the connection string
4. Add as `DATABASE_URL` in Vercel environment variables

### Redis (Optional - Recommended for Performance)
1. Go to https://upstash.com and sign up
2. Create a Redis database (free tier available)
3. Copy the `UPSTASH_REDIS_REST_URL` or `REDIS_URL`
4. Add as `REDIS_URL` in Vercel environment variables

---

## Deploy via CLI (Alternative)

If you prefer CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Or use npx (no install needed)
npx vercel

# Login (first time only)
npx vercel login

# Deploy
npx vercel

# Follow prompts:
# - Link to existing project? No (first time)
# - Project name? wikiguessr
# - Directory? ./
# - Override settings? No

# Set environment variables
npx vercel env add DATABASE_URL
npx vercel env add REDIS_URL  # Optional

# Deploy to production
npx vercel --prod
```

---

## Post-Deployment Checklist

- [ ] Set up PostgreSQL database and add `DATABASE_URL`
- [ ] Set up Redis (optional) and add `REDIS_URL`
- [ ] Run database migrations: Vercel should handle this automatically via `postinstall` script
- [ ] Test the deployed app at your Vercel URL
- [ ] Check Vercel logs if there are any errors

---

## Notes

- The app works **without Redis/PostgreSQL** (uses in-memory fallback), but it's recommended for production
- Vercel free tier includes:
  - 100GB bandwidth/month
  - Unlimited serverless function invocations
  - Automatic HTTPS
  - Custom domains (on paid plan)

---

## Troubleshooting

**Build fails with Prisma error:**
- Make sure `postinstall` script runs `prisma generate`
- Check that `DATABASE_URL` is set correctly

**Redis connection errors:**
- App will fall back to in-memory cache automatically
- Can run without Redis, but performance will be slower

**Database connection errors:**
- Verify `DATABASE_URL` format
- Check that database allows connections from Vercel IPs
- For Neon: Make sure to use the pooled connection URL
