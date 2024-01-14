import { Config } from "drizzle-kit";

export default {
    "out": "./db/migrations",
    "schema": "./db/schema/**/*.ts",
    "breakpoints": false,
    driver: "pg",
    dbCredentials: {
        connectionString: process.env.DB_CONNECTION
    }
} satisfies Config;