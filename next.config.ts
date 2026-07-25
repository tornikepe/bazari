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

    // Admins paste product image URLs by hand, so any HTTPS host is allowed.
    // Narrow this to the real CDN hostnames before going to production.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
