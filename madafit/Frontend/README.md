# MadaFit Hub - Frontend

Modern fitness management application built with React, TypeScript, and Tailwind CSS.

## Getting Started

### Prerequisites

- Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- Or use Bun as the package manager

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd Frontend

# Install dependencies
npm install
# or
bun install

# Start the development server
npm run dev
# or
bun run dev
```

The application will be available at `http://localhost:8080`

### Available Scripts

- `npm run dev` - Start development server with auto-reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint to check code quality
- `npm run test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Tech Stack

- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn-ui
- **Form Management**: React Hook Form
- **Data Fetching**: TanStack Query
- **Routing**: React Router
- **Testing**: Vitest

## Project Structure

```
src/
├── components/       # Reusable UI components
├── pages/           # Page components
├── hooks/           # Custom React hooks
├── lib/             # Utilities and helpers
├── data/            # Mock data and fixtures
└── test/            # Test files
```

## Contributing

Please follow the existing code style and commit conventions. Make sure to:

1. Run linting: `npm run lint`
2. Run tests: `npm run test`
3. Build before submitting: `npm run build`

## Support

For issues and feature requests, please open an issue on GitHub.
