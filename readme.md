# AnimepaheAPI

An unofficial REST API for [Animepahe](https://animepahe.ru/) that provides access to anime information, episodes, and streaming links.

## Features

- 🎯 Get currently airing anime
- 🔍 Search for specific anime
- 📋 Browse complete anime list
- 📺 Get anime details and episodes
- 🎬 Get streaming links
- 📱 Check encoding queue status
- ⚡ Fast and reliable
- 🛡️ Built-in DDoS protection bypass
- 🔄 Automatic cookie management

## Installation

```bash
git clone https://github.com/ElijahCodes12345/animepahe-api.git
cd animepahe-api
npm install
npx playwright install
copy .env.example .env
```

## Configuration

It works as it is but if you want you can create a `.env` file in the root directory:

```env
PORT=3000 # Optional
BASE_URL=https://animepahe.ru # Optional
USER_AGENT=  # Optional
COOKIES=     # Optional - for manual cookie management
USE_PROXY=false
PROXIES=     # Optional - comma-separated proxy URLs
```

## API Endpoints

### Airing Anime
```
GET /api/airing
GET /api/airing?page=2
```

### Search Anime
```
GET /api/search?q=your_search_query
GET /api/search?q=your_search_query&page=2
```

### Anime List
```
GET /api/anime
GET /api/anime?tab=A
GET /api/:tag1/:tag2
```

### Anime Information
```
GET /api/:id
GET /api/:id/releases?sort=episode_desc&page=1
```

### Streaming
```
GET /api/play/:id?episodeId=example
```

### Queue Status
```
GET /api/queue
```

## Error Handling

The API returns errors in this format:

```json
{
  "status": 503,
  "message": "Request failed with status code 404"
}
```

## Technologies Used

- Node.js
- Express
- Playwright
- @sparticuz/chromium
- Cheerio
- Axios

## License

This project is licensed under the MIT License.

## Disclaimer

This project is not affiliated with or endorsed by Animepahe. It's an unofficial API created for educational purposes.

## Support

If you find this project helpful, please give it a ⭐️ on GitHub!