import { defaultCache } from "@serwist/next/worker";
import { NetworkOnly, Serwist } from "serwist";

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [
        // Personal plans must never be served from a shared HTTP cache after an
        // account switch. Pending edits are stored separately, scoped by user.
        { matcher: ({ url }) => url.pathname === '/api/staff/preparation', handler: new NetworkOnly() },
        { matcher: ({ url }) => url.pathname.startsWith('/api/review-lab/google-3d'), handler: new NetworkOnly() },
        { matcher: ({ url }) => url.pathname.startsWith('/api/review-lab/map-context'), handler: new NetworkOnly() },
        ...defaultCache,
    ],
    fallbacks: {
        entries: [
            {
                url: "/~offline",
                matcher({ request }) {
                    return request.destination === "document";
                },
            },
        ],
    },
});

serwist.addEventListeners();
