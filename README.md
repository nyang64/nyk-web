# NYK Labs User Registration UI - Static SPA

This is a static Single Page Application (SPA) built with React Router 7, ready for cheap S3 hosting.

## What You Have

✅ **Beautiful card-based UI** with dark theme  
✅ **Client-side routing** (no server needed)  
✅ **Registration form** with API integration  
✅ **Multiple pages**: Home, Hashed Lierre, Registration, FAQ  
✅ **Fully static** - perfect for S3/CloudFront hosting

## Quick Start

### Development
```bash
npm run dev
```
Opens development server at http://localhost:5173

### Production Build & Test
```bash
# Build the static files
npm run build

# Preview the production build locally
npm run preview
```
Then open http://localhost:3000 - your SPA will work perfectly with all routes and the nice card layout!

## Important Notes

### ⚠️ DON'T Open index.html Directly!

**Never** open `build/client/index.html` directly in your browser (file:// protocol). This will NOT work because:
- SPAs need a web server to handle routing
- JavaScript modules require proper CORS headers
- Asset paths need to resolve correctly

**Always** use `npm run preview` or deploy to a web server (like S3).

## Deployment to S3

See [S3_DEPLOYMENT.md](./S3_DEPLOYMENT.md) for complete deployment instructions.

**Quick deployment:**
```bash
npm run build
aws s3 sync ./build/client s3://your-bucket-name --delete
```

## How It Works

1. All routes (/, /registration, /faq, etc.) are handled client-side
2. The app loads `index.html` + JavaScript bundles
3. React Router hydrates the page and shows the correct route
4. Navigation happens without page reloads
5. Your beautiful card CSS layout renders perfectly

## File Structure

```
build/client/          # Production build (deploy this to S3)
├── index.html         # Single HTML file
├── assets/            # JS, CSS bundles
├── nyk-logo.png
└── mock1.png

app/
├── routes/            # Your pages
│   ├── home.tsx
│   ├── registration.tsx
│   ├── faq.tsx
│   └── hashed-lierre.tsx
├── app.css            # Your beautiful card styling
└── root.tsx           # Layout with nav & footer
```

## Cost

Hosting on S3 + CloudFront: **< $1-2/month** for typical traffic

Enjoy your cheap, fast, beautiful SPA! 🚀
