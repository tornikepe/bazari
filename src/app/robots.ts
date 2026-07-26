import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing here is useful in an index, and order pages contain
      // customer details.
      disallow: ["/dashboard", "/dashboard/", "/checkout", "/cart", "/order/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
