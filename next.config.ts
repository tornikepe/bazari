import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * The OG-image routes read a font off disk at request time. Next's tracer
   * follows imports, not `readFile(join(process.cwd(), …))`, so on a
   * serverless deploy the file can be left out of the bundle — the route then
   * throws ENOENT in production while working perfectly in a local build.
   * Naming it here makes the inclusion explicit rather than lucky.
   */
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/**/*"],
    "/product/[slug]/opengraph-image": ["./assets/**/*"],
    // The invoice PDF reads the same fonts the same way — from the download
    // route, and from `placeOrder`, which draws one for the confirmation email
    // and is bundled with the page that renders the checkout form.
    "/api/orders/[number]/invoice": ["./assets/**/*", "./node_modules/pdfkit/js/data/**/*"],
    "/checkout": ["./assets/**/*", "./node_modules/pdfkit/js/data/**/*"],
  },

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
