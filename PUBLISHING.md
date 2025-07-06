# 🌐 Publishing Guide - Make Your MCP Server Available Worldwide

This guide shows you how to publish your fixed Nextcloud Calendar MCP server online in multiple ways.

## 📦 **Method 1: NPM Registry (Recommended)**

### Step 1: Set Up NPM Account
```bash
# Create account at https://www.npmjs.com/signup
# Then login locally
npm login
```

### Step 2: Build and Test
```bash
# Build the project
npm run build

# Test locally
npm test

# Test the package works
npm pack  # Creates a .tgz file for testing
```

### Step 3: Publish to NPM
```bash
# Publish your package
npm publish

# Check it's live
npm view @nidalhaddad1234/mcp-nextcloud-calendar
```

### Step 4: Users Can Now Install
```bash
# Anyone can now install your package
npm install -g @nidalhaddad1234/mcp-nextcloud-calendar
```

## 🏷️ **Method 2: GitHub Releases**

### Step 1: Create Release
```bash
# Tag the current version
git tag -a v1.0.0 -m "Release v1.0.0 - MCP Protocol Compliance Fix"
git push origin v1.0.0
```

### Step 2: Create GitHub Release
1. Go to https://github.com/nidalhaddad1234/mcp-nextcloud-calendar/releases
2. Click "Create a new release"
3. Select tag `v1.0.0`
4. Title: "v1.0.0 - MCP Protocol Compliance Fix"
5. Description:
```markdown
## 🔧 What's Fixed
- ✅ JSON parsing errors in Claude Desktop resolved
- ✅ Full MCP protocol compliance
- ✅ Proper stdout/stderr separation
- ✅ Session management improvements

## 📦 Installation
```bash
npm install -g @nidalhaddad1234/mcp-nextcloud-calendar
```

## 🚀 Quick Start
1. Set environment variables for Nextcloud
2. Add to Claude Desktop config
3. Start using calendar tools!

See [README.md](README.md) for full documentation.
```

## 🐳 **Method 3: Docker Hub**

### Step 1: Create Dockerfile
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY build/ ./build/
COPY .env.example ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcp -u 1001
USER mcp

EXPOSE 3000

CMD ["node", "build/index.js"]
```

### Step 2: Build and Push
```bash
# Build Docker image
docker build -t nidalhaddad1234/mcp-nextcloud-calendar:latest .

# Test locally
docker run -p 3000:3000 \
  -e NEXTCLOUD_BASE_URL=https://your-cloud.com \
  -e NEXTCLOUD_USERNAME=user \
  -e NEXTCLOUD_APP_TOKEN=token \
  nidalhaddad1234/mcp-nextcloud-calendar:latest

# Push to Docker Hub
docker login
docker push nidalhaddad1234/mcp-nextcloud-calendar:latest
```

### Step 3: Users Can Run
```bash
# Anyone can now run your container
docker run -p 3000:3000 \
  -e NEXTCLOUD_BASE_URL=https://their-cloud.com \
  -e NEXTCLOUD_USERNAME=their-user \
  -e NEXTCLOUD_APP_TOKEN=their-token \
  nidalhaddad1234/mcp-nextcloud-calendar:latest
```

## 🌍 **Method 4: Cloud Deployment**

### Option A: Railway
1. Go to https://railway.app
2. Connect your GitHub repo
3. Deploy automatically

### Option B: Render
1. Go to https://render.com
2. Connect GitHub repo
3. Set environment variables
4. Deploy

### Option C: Fly.io
```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch
fly deploy
```

## 📚 **Method 5: Documentation Site**

### Create GitHub Pages Documentation
```bash
# Create docs branch
git checkout -b gh-pages

# Create simple docs site
mkdir docs
cat > docs/index.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Nextcloud Calendar MCP Server</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
               max-width: 800px; margin: 0 auto; padding: 2rem; }
        code { background: #f5f5f5; padding: 0.2rem 0.5rem; border-radius: 3px; }
        pre { background: #f5f5f5; padding: 1rem; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>Nextcloud Calendar MCP Server</h1>
    <p>MCP-compliant server for Nextcloud Calendar integration with Claude Desktop.</p>
    
    <h2>Quick Install</h2>
    <pre><code>npm install -g @nidalhaddad1234/mcp-nextcloud-calendar</code></pre>
    
    <h2>Links</h2>
    <ul>
        <li><a href="https://www.npmjs.com/package/@nidalhaddad1234/mcp-nextcloud-calendar">NPM Package</a></li>
        <li><a href="https://github.com/nidalhaddad1234/mcp-nextcloud-calendar">GitHub Repository</a></li>
        <li><a href="https://hub.docker.com/r/nidalhaddad1234/mcp-nextcloud-calendar">Docker Image</a></li>
    </ul>
</body>
</html>
EOF

# Enable GitHub Pages
git add docs/
git commit -m "Add documentation site"
git push origin gh-pages
```

## 🎯 **Marketing Your Package**

### 1. Submit to Directories
- **NPM Registry**: Automatic when you publish
- **GitHub Topics**: Add topics to your repo
- **Awesome Lists**: Submit to MCP awesome lists
- **Reddit**: Post in r/ChatGPT, r/ClaudeAI

### 2. Social Media
- Twitter/X with hashtags: #MCP #ClaudeDesktop #Nextcloud
- LinkedIn technical posts
- Dev.to articles

### 3. Documentation
- Write blog posts about usage
- Create video tutorials
- Submit to MCP community showcase

## 📊 **Track Usage**

### NPM Stats
```bash
# Check download stats
npm view @nidalhaddad1234/mcp-nextcloud-calendar

# Monitor with npm-stat
npx npm-stat @nidalhaddad1234/mcp-nextcloud-calendar
```

### GitHub Stats
- Watch stars, forks, issues
- Use GitHub Insights
- Monitor clone statistics

## 🔄 **Update Process**

### For NPM Updates
```bash
# Update version
npm version patch  # or minor/major

# Rebuild and test
npm run build
npm test

# Publish update
npm publish

# Update git
git push origin main --tags
```

### For Docker Updates
```bash
# Build new version
docker build -t nidalhaddad1234/mcp-nextcloud-calendar:v1.0.1 .
docker tag nidalhaddad1234/mcp-nextcloud-calendar:v1.0.1 nidalhaddad1234/mcp-nextcloud-calendar:latest

# Push updates
docker push nidalhaddad1234/mcp-nextcloud-calendar:v1.0.1
docker push nidalhaddad1234/mcp-nextcloud-calendar:latest
```

## ✅ **Checklist for Going Live**

- [ ] NPM account created and verified
- [ ] Package.json updated with correct info
- [ ] README.md comprehensive and clear
- [ ] Tests passing
- [ ] Environment variables documented
- [ ] License file included
- [ ] Keywords added for discoverability
- [ ] Version tagged in git
- [ ] NPM package published
- [ ] GitHub release created
- [ ] Docker image built and pushed
- [ ] Documentation site live
- [ ] Social media announcements

## 🎉 **Your Package Will Be Available At:**

- **NPM**: `https://www.npmjs.com/package/@nidalhaddad1234/mcp-nextcloud-calendar`
- **GitHub**: `https://github.com/nidalhaddad1234/mcp-nextcloud-calendar`
- **Docker Hub**: `https://hub.docker.com/r/nidalhaddad1234/mcp-nextcloud-calendar`
- **Docs**: `https://nidalhaddad1234.github.io/mcp-nextcloud-calendar`

Your MCP server will now be discoverable and installable by the global developer community!
