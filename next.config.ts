import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The bundled sample photo is an SVG. Next refuses to optimise SVG unless
    // this is on, because a hostile SVG can carry script — the CSP below is
    // what makes that safe: optimised images are served sandboxed, with
    // scripts and framing blocked.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; frame-src 'none'; sandbox;",

    // Only hosts we actually serve images from. A wildcard here turns the
    // image optimiser into an open proxy that will fetch any URL a visitor
    // asks for, on our bandwidth and from our IP.
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
