This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Netlify

1. Commit your changes and push the repository to GitHub, GitLab, or Bitbucket.
2. In Netlify, select **Add new site → Import an existing project** and point it at this repo.
3. When prompted for the build settings, Netlify detects `netlify.toml`. Confirm the base directory is `my-app`, the build command is `npm run build`, and the publish directory is `.next`.
4. Configure the required environment variables in **Site settings → Environment variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_BACKEND_URL` (or `BACKEND_URL`) pointing to your deployed Python backend.
5. Trigger a deploy in Netlify. Each push to the tracked branch will redeploy automatically.

> Tip: When running locally, the rewrite falls back to `http://localhost:8000`. Override it by exporting `BACKEND_URL` if your backend runs elsewhere.
