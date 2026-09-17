/**
 * Puts the information pages back to the text that ships in the repo.
 *
 * The seed writes these rows once and never touches them again, because
 * once a row exists it is the owner's to edit. That rule has one bad day:
 * when the shipped text itself is what changed — as when every page stopped
 * describing a demo and started describing a shop — and nobody had edited
 * the rows, so the old text simply stayed live.
 *
 * Overwrites the title, intro and body in both languages for every page,
 * and keeps `isPublished` and the order, which are the owner's. Refuses to
 * run without `--yes`, because it does discard any edits made from the
 * dashboard; take a backup first (`npm run db:backup`).
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getInfoPage, INFO_SLUGS } from "../src/lib/info-pages";
import { serialiseSections } from "../src/lib/info-content";

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("This replaces the text of every information page with the repo's copy.");
    console.error("Take a backup (npm run db:backup), then run it again with --yes.");
    process.exit(1);
  }

  for (const [index, slug] of INFO_SLUGS.entries()) {
    const ka = getInfoPage(slug, "ka");
    const en = getInfoPage(slug, "en");
    const text = {
      titleKa: ka.title,
      titleEn: en.title,
      introKa: ka.intro,
      introEn: en.intro,
      bodyKa: serialiseSections(ka.sections),
      bodyEn: serialiseSections(en.sections),
    };
    await prisma.infoPage.upsert({
      where: { slug },
      update: text,
      create: { slug, ...text, sortOrder: index },
    });
    console.log(`  /${slug} — ${ka.title}`);
  }
  console.log(`${INFO_SLUGS.length} pages refreshed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
