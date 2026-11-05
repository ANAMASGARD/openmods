import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  env: { NEXT_PUBLIC_SENTRY_RELEASE: process.env.SENTRY_RELEASE ?? process.env.RENDER_GIT_COMMIT ?? '', NEXT_PUBLIC_OPENMODS_ENV: process.env.OPENMODS_ENV ?? 'development' },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSentryConfig(nextConfig, { org: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, authToken: process.env.SENTRY_AUTH_TOKEN, silent: true, sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN } });
