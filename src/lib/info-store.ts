import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { getInfoPage as builtInPage, INFO_SLUGS, type InfoSlug } from "@/lib/info-pages";
import {
  parseSections,
  serialiseSections,
  substitute,
  type InfoSection,
} from "@/lib/info-content";
import type { Locale } from "@/lib/i18n";

/**
 * The information pages, read from the database.
 *
 * The prose that ships in `info-pages.ts` is still here, as the fallback. That
 * is deliberate rather than leftover: a fresh clone with an unseeded database
 * should render a complete site, and a shop that has never opened this part of
 * the dashboard should not have seven blank pages. The table is the source of
 * truth once a row exists; before that, the repo is.
 */

export type InfoContent = {
  slug: InfoSlug;
  title: string;
  intro: string;
  sections: InfoSection[];
  isPublished: boolean;
};

/** One query for every page on the request, however many components ask. */
const loadRows = cache(async () => {
  try {
    const rows = await prisma.infoPage.findMany();
    return new Map(rows.map((row) => [row.slug, row]));
  } catch (error) {
    // Same reasoning as `getSettings`: the footer needs this on every page, so
    // throwing here is a site-wide outage caused by a content read.
    console.error("[info] falling back to the built-in pages", error);
    return new Map();
  }
});

async function values(locale: Locale) {
  const settings = await getSettings();
  return {
    freeShippingThreshold: formatPrice(settings.freeShippingThreshold, locale),
    shippingFee: formatPrice(settings.shippingFee, locale),
    shopName: settings.name,
  };
}

export async function getPage(slug: InfoSlug, locale: Locale): Promise<InfoContent> {
  const [rows, subs] = await Promise.all([loadRows(), values(locale)]);
  const row = rows.get(slug);

  if (!row) {
    // The fallback needs the same substitution the stored copy gets, or an
    // unseeded install renders the literal string "{freeShipping}".
    const built = builtInPage(slug, locale);
    return {
      slug,
      title: substitute(built.title, subs),
      intro: substitute(built.intro, subs),
      sections: built.sections.map((section) => ({
        heading: substitute(section.heading, subs),
        body: section.body.map((paragraph) => substitute(paragraph, subs)),
      })),
      isPublished: true,
    };
  }

  const title = locale === "ka" ? row.titleKa : row.titleEn;
  const intro = locale === "ka" ? row.introKa : row.introEn;
  const body = locale === "ka" ? row.bodyKa : row.bodyEn;

  return {
    slug,
    title,
    intro,
    sections: parseSections(body, subs),
    isPublished: row.isPublished,
  };
}

/**
 * The pages the footer should link to.
 *
 * Unpublished ones are dropped, and so are ones with no title in the language
 * being read — a link to a page that renders nothing is worse than no link.
 */
export async function getPublishedPages(locale: Locale): Promise<InfoContent[]> {
  const pages = await Promise.all(INFO_SLUGS.map((slug) => getPage(slug, locale)));
  return pages.filter((page) => page.isPublished && page.title.trim().length > 0);
}

/** Every page as stored, for the dashboard's editor. */
export async function getAllPagesForEditing() {
  const rows = await loadRows();

  return Promise.all(
    INFO_SLUGS.map(async (slug) => {
      const row = rows.get(slug);
      if (row) return row;

      // Not yet in the table: hand back the shipped text so the editor opens
      // on real content rather than an empty form the owner has to fill in
      // from nothing.
      // Unsubstituted on purpose: the editor should show `{freeShipping}`,
      // which is what the owner edits, not the resolved figure.
      const ka = builtInPage(slug, "ka");
      const en = builtInPage(slug, "en");

      return {
        slug,
        titleKa: ka.title,
        titleEn: en.title,
        introKa: ka.intro,
        introEn: en.intro,
        bodyKa: serialiseSections(ka.sections),
        bodyEn: serialiseSections(en.sections),
        isPublished: true,
        sortOrder: 0,
        updatedAt: new Date(),
      };
    }),
  );
}
