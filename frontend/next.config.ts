import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pure client-side dapp: wallet in the browser, RPC straight to a node.
  // A static export runs on any host — Vercel, GitHub Pages, IPFS — with no
  // server component, which is the honest shape for this app.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
