# MIDB - Movie Information Database

MIDB is a software platform for creating a website to collect and display data about movies, with a focus on diversity. Please note that MIDB is a working title and may be subject to change.

## Development Setup

This project is set up using Bun and has only been tested with Bun.

### Configuration

To run the project, you will need the following prerequisites: a PostgreSQL database, a [hanko account](https://www.hanko.io/) and a Bun runtime environment. You must set the following environment variables, which can be done using an .env file:

```env
PUBLIC_HANKO_API_URL=<api-key>.hanko.io

DB_CONNECTION=postgres://postgres:mysecretpassword@0.0.0.0:5432/midb
AUTH_SECRET=secret
```

### Starting the Environment

To get started, follow these steps, migration run at starup time:

1. Install the project dependencies.
```bun install```
2. Run the development server. This project is based on SvelteKit.
```bun run dev```