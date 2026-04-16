# 🎬 VideoSite — Full-Stack Video Publishing Platform

A clean, modern, SEO-optimized video publishing platform built with React + Vite, Node.js + Express, MongoDB, and Cloudinary. Only the admin can upload videos; anyone can watch them.

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js)
![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?style=flat&logo=mongodb)
![Cloudinary](https://img.shields.io/badge/Cloudinary-Storage-3448C5?style=flat)

---

## ✨ Features

### Public
- 🏠 **Homepage** — responsive video grid with thumbnails, titles, view counts
- ▶️ **Video player** — custom HTML5 player with keyboard shortcuts, fullscreen, progress bar
- 🔍 **Related videos** — sidebar with up-next suggestions
- 📊 **View counting** — auto-increments on every watch
- 📱 **Mobile-first** responsive design

### Admin Panel
- 🔐 Password-protected route (no JWT complexity)
- ⬆️ Upload videos with title, description, tags
- 🖼️ Thumbnail upload with live preview
- 📈 Upload progress bar
- 🗑️ Delete videos (removes from Cloudinary too)
- 📋 List all uploaded videos

### SEO
- Dynamic `<title>`, `<meta>`, Open Graph, Twitter Card per page
- JSON-LD structured data (VideoObject schema)
- `/sitemap.xml` — auto-generated from MongoDB
- `/robots.txt` — served from Express
- Canonical URLs
- Lazy loading for images

### Ads (Placeholder UI)
- Top banner (Homepage) — 728×90 Leaderboard
- Sidebar (Video page) — 300×250 Medium Rectangle
- In-feed (Grid, every 8 videos) — Native Ad Unit

---

## 📁 Folder Structure

```
videosite/
├── server/                  # Node.js + Express backend
│   ├── config/
│   │   └── cloudinary.js    # Cloudinary + Multer config
│   ├── middleware/
│   │   └── auth.js          # Admin password middleware
│   ├── models/
│   │   └── Video.js         # Mongoose schema
│   ├── routes/
│   │   └── videos.js        # All API routes
│   ├── server.js            # Express app entry
│   ├── .env.example
│   └── package.json
│
├── client/                  # React + Vite frontend
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── api/
│   │   │   └── index.js     # Axios API client
│   │   ├── components/
│   │   │   ├── AdPlaceholders.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── SEOHead.jsx
│   │   │   ├── Skeletons.jsx
│   │   │   ├── VideoCard.jsx
│   │   │   └── VideoPlayer.jsx
│   │   ├── context/
│   │   │   └── AdminContext.jsx
│   │   ├── pages/
│   │   │   ├── Admin.jsx
│   │   │   ├── Home.jsx
│   │   │   ├── NotFound.jsx
│   │   │   └── VideoDetail.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   ├── .env.example
│   └── package.json
│
├── package.json             # Root scripts (concurrently)
├── .gitignore
└── README.md
```

---

## 🚀 Setup Instructions

### Prerequisites

- **Node.js** v18+ — [nodejs.org](https://nodejs.org)
- **MongoDB** — [MongoDB Atlas](https://cloud.mongodb.com) (free) or local install
- **Cloudinary** account — [cloudinary.com](https://cloudinary.com) (free tier works)

---

### Step 1 — Clone & Install

```bash
# Clone the repo
git clone https://github.com/yourname/videosite.git
cd videosite

# Install root dependencies
npm install

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

Or use the convenience script:
```bash
npm run install:all
```

---

### Step 2 — Configure Server Environment

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

```env
PORT=5000
NODE_ENV=development

# Get your MongoDB URI from Atlas or use local
MONGODB_URI=mongodb://localhost:27017/videosite

# From your Cloudinary dashboard → Settings → API Keys
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Choose a strong password for the admin panel
ADMIN_PASSWORD=mysecretpassword123

# Your frontend URL (for CORS)
CLIENT_URL=http://localhost:5173
```

---

### Step 3 — Configure Client Environment

```bash
cd client
cp .env.example .env
```

Edit `client/.env`:

```env
# Only needed for production; dev uses Vite proxy
VITE_SITE_URL=https://yoursite.com
```

---

### Step 4 — Get Cloudinary Credentials

1. Sign up at [cloudinary.com](https://cloudinary.com)
2. Go to **Dashboard** → copy **Cloud Name**, **API Key**, **API Secret**
3. Paste into `server/.env`

> **Free tier**: 25 GB storage, 25 GB monthly bandwidth — plenty to start.

---

### Step 5 — Run the App

**Both server + client together (recommended):**
```bash
# From project root
npm run dev
```

**Or run separately:**
```bash
# Terminal 1 — Backend
cd server && npm run dev
# → http://localhost:5000

# Terminal 2 — Frontend
cd client && npm run dev
# → http://localhost:5173
```

---

### Step 6 — Access the App

| URL | Description |
|-----|-------------|
| `http://localhost:5173` | Homepage (public) |
| `http://localhost:5173/video/:id` | Video watch page |
| `http://localhost:5173/admin` | Admin panel |
| `http://localhost:5000/api/health` | API health check |
| `http://localhost:5000/sitemap.xml` | SEO sitemap |
| `http://localhost:5000/robots.txt` | Robots file |

---

## 📡 API Reference

All endpoints are prefixed with `/api`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/videos` | No | List all videos (paginated) |
| `GET` | `/videos/:id` | No | Get single video + increment views |
| `GET` | `/videos/sitemap` | No | Get all video slugs/IDs for sitemap |
| `POST` | `/videos/upload` | ✅ Admin | Upload video + thumbnail |
| `PATCH` | `/videos/:id` | ✅ Admin | Update video metadata |
| `DELETE` | `/videos/:id` | ✅ Admin | Delete video + Cloudinary assets |

**Admin auth**: Send `x-admin-password: yourpassword` header.

**GET /videos query params:**
- `page` — page number (default: 1)
- `limit` — items per page (default: 12, max: 50)
- `sort` — `createdAt` (default) or `views`

**POST /videos/upload body** (multipart/form-data):
- `title` — string, required
- `description` — string
- `tags` — comma-separated string
- `video` — file, required (mp4/mov/avi/mkv/webm, max 500MB)
- `thumbnail` — file, required (jpg/png/webp, max 5MB)

---

## 🏗️ Production Deployment

### Build the client
```bash
cd client && npm run build
# Output: client/dist/
```

### Serve static files from Express (optional)
Add to `server/server.js`:
```js
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});
```

### Environment for production
```env
NODE_ENV=production
CLIENT_URL=https://yoursite.com
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/videosite
```

### Recommended platforms
- **Backend**: Railway, Render, Fly.io, or a VPS
- **Frontend**: Vercel, Netlify, or Cloudflare Pages
- **Database**: MongoDB Atlas (free M0 cluster)
- **Storage**: Cloudinary (already configured)

---

## 🎨 Customization

### Change the admin password
Update `ADMIN_PASSWORD` in `server/.env`.

### Change theme colors
Edit `client/tailwind.config.js` → `theme.extend.colors.brand`.

### Add real ads
Replace components in `client/src/components/AdPlaceholders.jsx` with your ad network script tags (Google AdSense, etc.).

### Change video upload limits
- File size: `server/config/cloudinary.js` → `limits.fileSize`
- Transformations: same file → `params.transformation`

---

## 🔒 Security Notes

- Admin password is checked on every admin request server-side
- Rate limiting: 200 req/15min general, 20 uploads/hour
- Helmet.js for HTTP security headers
- CORS restricted to `CLIENT_URL`
- Input validation on all endpoints
- In production, consider upgrading to JWT authentication

---

## 📄 License

MIT — free to use and modify.
