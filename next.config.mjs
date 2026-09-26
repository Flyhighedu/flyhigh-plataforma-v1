import { spawnSync } from "node:child_process";
import withSerwistInit from "@serwist/next";

const revision = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ?? crypto.randomUUID();

const withSerwist = withSerwistInit({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.js",
  swDest: "public/sw.js",
  scope: "/staff/",
  register: false,
  disable: process.env.NODE_ENV !== "production",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.FLYHIGH_REVIEW_LAB === '1' ? '.next-review' : '.next',
  productionBrowserSourceMaps: true,
  allowedDevOrigins: process.env.FLYHIGH_REVIEW_MOBILE_HOST ? [process.env.FLYHIGH_REVIEW_MOBILE_HOST] : [],
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        os: false,
        crypto: false,
        path: false,
      };
    }
    return config;
  },
};

export default withSerwist(nextConfig);
