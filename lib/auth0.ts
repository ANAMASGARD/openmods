import { Auth0Client } from "@auth0/nextjs-auth0/server";

import { AUTH_RETURN_TO } from "@/lib/auth-providers";

export const auth0 = new Auth0Client({
  signInReturnToPath: AUTH_RETURN_TO,
});

export function isAuthConfigured() {
  return Boolean(
    process.env.AUTH0_DOMAIN &&
      process.env.AUTH0_CLIENT_ID &&
      process.env.AUTH0_CLIENT_SECRET &&
      process.env.AUTH0_SECRET &&
      process.env.APP_BASE_URL,
  );
}

export async function getOptionalSession() {
  if (!isAuthConfigured()) {
    return null;
  }

  try {
    return await auth0.getSession();
  } catch {
    return null;
  }
}
