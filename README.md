
# Stable Manager App

A web application built with **React**, **TypeScript**, and **Vite**, designed to help larger boarding stables manage their day-to-day operations in one place. Running a boarding stable means juggling a lot of moving parts — who's boarding where, what each horse eats and when, who's coming by for a lesson or a vet visit — and this project aims to bring that all into a single, easy-to-use interface.

## Features

- **Boarder management** — keep track of boarders and their horses in one organized system, instead of scattered spreadsheets or paper records.
- **Feeding schedules** — set up and manage feeding plans so staff always know what each horse needs and when.
- **Shared calendar** — coordinate lessons, vet visits, farrier appointments, and other stable events in a central calendar everyone can see.

> This project is under active development. Testing is planned to begin in January 2027.

## Tech Stack

- **React 19** — UI library
- **TypeScript** — type safety
- **Vite** — build tool and dev server
- **React Router** — client-side routing
- **Tailwind CSS** — styling
- **Supabase** — backend, authentication, and database

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- npm (comes with Node.js)
- A [Supabase](https://supabase.com/) project (for backend/database access)

### Installation

1. Clone the repository:

```bash
   git clone https://github.com/GroAnita/Stable_Manager_app_react.git
   cd Stable_Manager_app_react
```

2. Install dependencies:

```bash
   npm install
```

3. Set up environment variables:

```bash
   cp .env.example .env
```

   Then fill in your Supabase project URL and API key in `.env`.

4. Start the development server:

```bash
   npm run dev
```

### Available Scripts

| Command           | Description                              |
| ----------------- | ----------------------------------------- |
| `npm run dev`     | Starts the local development server       |
| `npm run build`   | Type-checks and builds for production     |
| `npm run preview` | Previews the production build locally     |
| `npm run lint`    | Runs Oxlint and ESLint                    |
| `npm run format`  | Formats the codebase with Prettier        |

## Project Status

This is a personal project, currently in active development. Core features (boarder management, feeding schedules, and calendar) are being built out, with testing planned to begin in **January 2027**.








Track tools and referenced files used in this task.

