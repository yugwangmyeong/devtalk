# DevTalk

Real-time communication platform built with Next.js, React, TypeScript, Tailwind CSS, Zustand, Socket.IO, Prisma, and MySQL.

## Tech Stack

### Frontend
- **Next.js** - React framework
- **React** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **socket.io-client** - Real-time communication

### Backend
- **Next.js Route API** - API routes
- **Prisma** - ORM
- **MySQL** - Database
- **Socket.IO** - Real-time server
- **Redis** - Caching & scaling (optional)

## Getting Started

### Prerequisites
- Node.js 18+ 
- MySQL database
- Redis (optional, for scaling)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and configure:
- `DATABASE_URL` - MySQL connection string
- `REDIS_URL` - Redis connection string (optional)
- `NEXT_PUBLIC_SOCKET_URL` - Socket.IO server URL (default: http://localhost:3000)

3. Set up the database:
```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push

# Or run migrations
npm run db:migrate
```

4. Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Project Structure

```
devtalk/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   └── socket/       # Socket.IO endpoint
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/            # React components
│   └── SocketProvider.tsx
├── lib/                   # Utility libraries
│   ├── prisma.ts         # Prisma client
│   ├── redis.ts          # Redis client
│   └── socket.ts         # Socket.IO server
├── stores/                # Zustand stores
│   └── useSocketStore.ts
├── types/                 # TypeScript types
│   └── socket.ts
├── prisma/                # Prisma schema
│   └── schema.prisma
├── server.ts              # Custom server with Socket.IO
└── package.json
```

## Available Scripts

- `npm run dev` - Start development server with Socket.IO
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma Client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

## Features

- ✅ Real-time communication with Socket.IO
- ✅ Type-safe database queries with Prisma
- ✅ State management with Zustand
- ✅ Modern UI with Tailwind CSS
- ✅ Scalable architecture with Redis support

## Development

### Adding Socket Events

1. Define event types in `types/socket.ts`
2. Add handlers in `lib/socket.ts`
3. Use the socket store in components via `useSocketStore()`

### Database Models

Edit `prisma/schema.prisma` to add or modify models, then run:
```bash
npm run db:push
# or
npm run db:migrate
```

## License

MIT
