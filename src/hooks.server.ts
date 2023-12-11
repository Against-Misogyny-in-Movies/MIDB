import { SvelteKitAuth } from "@auth/sveltekit"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import EmailProvider from "@auth/core/providers/email"
import dbConnection from "$db/connections.js";

import { EMAIL_SERVER_HOST, EMAIL_SERVER_PORT, EMAIL_SERVER_USER, EMAIL_SERVER_PASSWORD, EMAIL_FROM } from "$env/static/private"

export const handle = SvelteKitAuth({
  providers: [
    EmailProvider({
      server: {
        host: EMAIL_SERVER_HOST,
        port: EMAIL_SERVER_PORT,
        auth: {
          user: EMAIL_SERVER_USER,
          pass: EMAIL_SERVER_PASSWORD
        }
      },
      from: EMAIL_FROM
    }),
  ],
  adapter: DrizzleAdapter(dbConnection)
})