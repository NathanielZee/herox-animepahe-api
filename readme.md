# HeroX AnimepaheAPI

A **robust and reliable** unofficial REST API for [Animepahe](https://animepahe.ru/) with enhanced error handling, automatic retries, and fault tolerance.

## 🚀 Features

- 🎯 **Reliable**: Built-in retry mechanisms and error handling
- 🔄 **Fault Tolerant**: Works even when Redis or external services fail
- 🛡️ **DDoS Protection Bypass**: Advanced browser automation with stealth features
- ⚡ **Fast & Cached**: Redis caching with graceful fallback
- 🔍 **Complete API**: Search, browse, stream links, and more
- 📱 **Production Ready**: Optimized for serverless deployment
- 🎬 **Anti-Bot Bypass**: Handles modern protection systems

### Core Endpoints
- 🎯 Get currently airing anime
- 🔍 Search for specific anime  
- 📋 Browse complete anime catalog
- 📺 Get detailed anime information
- 🎬 Get streaming links for episodes
- 📊 Check encoding queue status

## 🛠️ Installation

```bash
git clone https://github.com/NathanielZee/herox-animepahe-api.git
cd herox-animepahe-api
npm install
npx playwright install
cp .env.example .env
```

## 🚀 Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FNathanielZee%2Fherox-animepahe-api)
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/NathanielZee/herox-animepahe-api)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/herox-animepahe-api?referralCode=heroX)

## ⚙️ Configuration

Create a `.env` file (optional - works without configuration):

```env
# Server
PORT=3000

# Base Configuration  
BASE_URL=https://animepahe.ru
USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36

# Optional: Manual Cookie Management
COOKIES=

# Optional: Proxy Support
USE_PROXY=false
PROXIES=http://user:pass@proxy1.com:8080,http://proxy2.com:8080

# Optional: Redis Caching (improves performance)
REDIS_URL=redis://user:pass@host:port
```

### 🔧 Redis Caching

The API supports Redis for improved performance:

- **With Redis**: Faster responses, reduced server load
- **Without Redis**: Still works perfectly, just slower
- **Redis Fails**: API continues normally with direct fetching

Cache durations:
- Queue status: 30 seconds
- Anime lists: 1 hour  
- Anime info: 1 day
- Streaming links: 30 minutes

## 📚 API Documentation

### Health Check
```http
GET /health
```

### Airing Anime
```http
GET /api/airing
GET /api/airing?page=2
```

### Search
```http
GET /api/search?q=one+piece
GET /api/search?q=naruto&page=2
```

### Browse Anime
```http
GET /api/anime
GET /api/anime?tab=A
GET /api/anime/genre/action
GET /api/anime/genre/action?tab=B
```

### Anime Details
```http
GET /api/:session
GET /api/:session/releases?sort=episode_desc&page=1
```

### Streaming Links
```http
GET /api/play/:session?episodeId=example_episode_id
```

### Queue Status
```http
GET /api/queue
```

## 🔧 Advanced Features

### Error Handling
- Automatic retries with exponential backoff
- Graceful degradation when services fail
- Comprehensive error responses with status codes

### Performance
- Connection pooling for HTTP requests
- Browser instance management
- Memory leak prevention
- Timeout handling

### Reliability
- Works offline (without Redis)
- Handles network interruptions  
- Anti-bot protection bypass
- Resource cleanup and graceful shutdown

## 📊 Response Format

### Success Response
```json
{
  "paginationInfo": {
    "total": 1000,
    "perPage": 8,
    "currentPage": 1,
    "lastPage": 125
  },
  "data": [...]
}
```

### Error Response
```json
{
  "status": 404,
  "message": "Anime not found"
}
```

## 🧪 Testing

```bash
# Start development server
npm run dev

# Test health endpoint
curl http://localhost:3000/health

# Test search
curl "http://localhost:3000/api/search?q=one+piece"
```

## 🏗️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Browser**: Playwright + Chromium
- **Parsing**: Cheerio
- **HTTP**: Axios with retry logic
- **Cache**: Redis (optional)
- **Deploy**: Vercel, Heroku, Railway

## 🔒 Rate Limiting & Fair Use

- Automatic retry delays prevent server overload
- Built-in timeouts prevent resource exhaustion
- Respectful scraping with proper delays

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This is an unofficial API created for educational purposes. Not affiliated with or endorsed by Animepahe.

## 🆘 Support

- 🐛 [Report Issues](https://github.com/NathanielZee/herox-animepahe-api/issues)
- 💬 [Discussions](https://github.com/NathanielZee/herox-animepahe-api/discussions)
- ⭐ Star this repo if it helps you!

---

**Made with ❤️ by NathanielZee**