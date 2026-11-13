# Baska Backend API

Backend server for the Baska shared shopping list application. Built with Express.js, SQLite, and JWT authentication.

## Features

- RESTful API for shopping list items and stores
- User authentication with JWT tokens
- Password hashing with bcrypt
- CORS protection
- SQLite database with better-sqlite3
- User-specific data isolation

## Prerequisites

- Node.js 18+ 
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Edit `.env` with your configuration:
```env
PORT=3000
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

**Important:** Generate a secure JWT_SECRET using:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm start
# or
npm run prod
```

The server will start on the configured PORT (default 3000).

## API Endpoints

### Authentication

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### Items (Protected - requires JWT token)

#### Get all items
```http
GET /api/items
Authorization: Bearer <token>
```

#### Get single item
```http
GET /api/items/:id
Authorization: Bearer <token>
```

#### Create item
```http
POST /api/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Milk",
  "qty": 2,
  "store": "Costco",
  "addedBy": "John"
}
```

#### Update item
```http
PUT /api/items/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Milk",
  "qty": 3,
  "done": true
}
```

#### Delete item
```http
DELETE /api/items/:id
Authorization: Bearer <token>
```

#### Toggle item done status
```http
PATCH /api/items/:id/toggle
Authorization: Bearer <token>
```

### Stores (Protected - requires JWT token)

#### Get all stores
```http
GET /api/stores
Authorization: Bearer <token>
```

#### Create store
```http
POST /api/stores
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Target"
}
```

#### Delete store
```http
DELETE /api/stores/:id
Authorization: Bearer <token>
```

### Health Check
```http
GET /api/health
```

## Deployment

### Traditional VPS (DigitalOcean, Linode, etc.)

1. Clone the repository
2. Install dependencies: `npm install --production`
3. Set up environment variables in `.env`
4. Start with PM2 for process management:
```bash
npm install -g pm2
pm2 start server.js --name baska-backend
pm2 startup
pm2 save
```

### Docker

Build and run with Docker:
```bash
docker build -t baska-backend .
docker run -p 3000:3000 --env-file .env baska-backend
```

### PaaS (Render, Railway, etc.)

1. Push code to Git repository
2. Connect repository to platform
3. Set environment variables in platform dashboard
4. Deploy

**Required environment variables:**
- `JWT_SECRET` - Random 32+ character string
- `ALLOWED_ORIGINS` - Comma-separated list of allowed frontend URLs
- `PORT` - Port number (platform usually sets this)

## Security Notes

- JWT_SECRET must be set and should be a strong random string
- CORS is restricted to configured origins only
- All data endpoints require authentication
- Passwords are hashed with bcrypt (10 rounds)
- Minimum password length: 8 characters
- User data is isolated by user_id

## Database

The application uses SQLite with better-sqlite3. The database file (`baska.db`) is created automatically on first run.

**Backup recommendations:**
- Regularly backup `baska.db` file
- For production, consider using a managed database service

## Troubleshooting

**Server won't start:**
- Ensure JWT_SECRET is set in `.env`
- Check that PORT is not already in use
- Verify all dependencies are installed

**Authentication errors:**
- Verify token is being sent in Authorization header
- Check token hasn't expired (7 day expiry)
- Ensure ALLOWED_ORIGINS includes your frontend domain

**Database errors:**
- Ensure the application has write permissions for the database directory
- Check disk space

## License

MIT
