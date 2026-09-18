// Better Auth in the browser: the login form asks for a link through it.
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ plugins: [magicLinkClient()] });
