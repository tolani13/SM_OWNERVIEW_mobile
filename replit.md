# Studio Maestro

## Overview

Studio Maestro is an all-in-one dance studio and competition management application. It provides tools for managing dancers, teachers, routines, competitions, finances, and studio announcements. The application is built as a full-stack TypeScript application with a React frontend and Express backend, using PostgreSQL for data persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS v4 with custom theme variables and CSS-in-JS via class-variance-authority
- **Fonts**: Outfit (display) and Inter (body) from Google Fonts
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful API with JSON request/response format
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Schema Validation**: Zod with drizzle-zod for runtime validation

### Data Storage
- **Database**: PostgreSQL (configured via DATABASE_URL environment variable)
- **Schema Location**: `shared/schema.ts` - contains all table definitions
- **Migrations**: Drizzle Kit with output to `./migrations` directory

### Key Data Models
- **Dancers**: Student profiles with parent/guardian contacts, age levels (Mini/Junior/Teen/Senior/Elite)
- **Teachers**: Instructor profiles with class assignments and solo availability
- **Routines**: Dance pieces with style, type, assigned dancers, and costume tracking
- **Competitions**: Events with run slots for scheduling performances
- **Fees**: Financial tracking for tuition, costumes, and competition fees
- **Announcements**: Studio communications with pinning support
- **Studio Classes**: Weekly class schedules with room bookings
- **Practice Bookings**: Private lesson scheduling

### Project Structure
```
client/           # React frontend application
  src/
    components/   # Reusable UI components
    pages/        # Route page components
    hooks/        # Custom React hooks (useData.ts for API)
    lib/          # Utilities, API client, query client
server/           # Express backend
  index.ts        # Server entry point
  routes.ts       # API route definitions
  storage.ts      # Database operations interface
  db.ts           # Database connection
shared/           # Shared code between frontend and backend
  schema.ts       # Drizzle schema definitions
```

### Build System
- Development: Vite dev server with HMR, tsx for server
- Production: Vite builds frontend to `dist/public`, esbuild bundles server to `dist/index.cjs`
- Database: `npm run db:push` uses Drizzle Kit to sync schema

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connection via `DATABASE_URL` environment variable
- **connect-pg-simple**: PostgreSQL session store (available but session auth not currently implemented)

### UI Libraries
- **Radix UI**: Full suite of accessible, unstyled UI primitives
- **Lucide React**: Icon library
- **embla-carousel-react**: Carousel component
- **cmdk**: Command palette component
- **react-day-picker**: Date picker component
- **vaul**: Drawer component

### Development Tools
- **Drizzle Kit**: Database migration and schema management
- **@replit/vite-plugin-***: Replit-specific development integrations (cartographer, dev-banner, runtime-error-modal)

### Form & Validation
- **react-hook-form**: Form state management
- **@hookform/resolvers**: Form validation resolvers
- **zod**: Schema validation
- **drizzle-zod**: Generate Zod schemas from Drizzle tables