/**
 * The towns a courier can be sent to, for the city box to suggest from —
 * typed "თ" and offered Tbilisi, Telavi, Tkibuli. Both names, so the
 * English site suggests in English, and a centre for each so the map can
 * open on the right town before a pin is placed.
 *
 * A list, not a table: it changes once a decade.
 */
export type City = { ka: string; en: string; lat: number; lng: number };

export const GEORGIAN_CITIES: readonly City[] = [
  { ka: "თბილისი", en: "Tbilisi", lat: 41.7151, lng: 44.8271 },
  { ka: "ბათუმი", en: "Batumi", lat: 41.6168, lng: 41.6367 },
  { ka: "ქუთაისი", en: "Kutaisi", lat: 42.2679, lng: 42.6946 },
  { ka: "რუსთავი", en: "Rustavi", lat: 41.5495, lng: 44.9963 },
  { ka: "გორი", en: "Gori", lat: 41.9842, lng: 44.1158 },
  { ka: "ზუგდიდი", en: "Zugdidi", lat: 42.5088, lng: 41.8709 },
  { ka: "ფოთი", en: "Poti", lat: 42.1462, lng: 41.6716 },
  { ka: "ხაშური", en: "Khashuri", lat: 41.9976, lng: 43.5983 },
  { ka: "სამტრედია", en: "Samtredia", lat: 42.1594, lng: 42.3364 },
  { ka: "სენაკი", en: "Senaki", lat: 42.2697, lng: 42.0683 },
  { ka: "ზესტაფონი", en: "Zestafoni", lat: 42.1097, lng: 43.0426 },
  { ka: "მარნეული", en: "Marneuli", lat: 41.4761, lng: 44.8106 },
  { ka: "თელავი", en: "Telavi", lat: 41.9198, lng: 45.4731 },
  { ka: "ახალციხე", en: "Akhaltsikhe", lat: 41.6392, lng: 42.9862 },
  { ka: "ქობულეთი", en: "Kobuleti", lat: 41.8203, lng: 41.7771 },
  { ka: "ოზურგეთი", en: "Ozurgeti", lat: 41.9243, lng: 42.0056 },
  { ka: "კასპი", en: "Kaspi", lat: 41.9256, lng: 44.4245 },
  { ka: "ჭიათურა", en: "Chiatura", lat: 42.2906, lng: 43.2825 },
  { ka: "წყალტუბო", en: "Tskaltubo", lat: 42.3410, lng: 42.5951 },
  { ka: "საგარეჯო", en: "Sagarejo", lat: 41.7333, lng: 45.3333 },
  { ka: "გარდაბანი", en: "Gardabani", lat: 41.4592, lng: 45.0917 },
  { ka: "ბორჯომი", en: "Borjomi", lat: 41.8400, lng: 43.3896 },
  { ka: "ტყიბული", en: "Tkibuli", lat: 42.3500, lng: 42.9964 },
  { ka: "ხონი", en: "Khoni", lat: 42.3226, lng: 42.4235 },
  { ka: "ბოლნისი", en: "Bolnisi", lat: 41.4489, lng: 44.5389 },
  { ka: "ახალქალაქი", en: "Akhalkalaki", lat: 41.4053, lng: 43.4864 },
  { ka: "გურჯაანი", en: "Gurjaani", lat: 41.7433, lng: 45.8006 },
  { ka: "მცხეთა", en: "Mtskheta", lat: 41.8453, lng: 44.7188 },
  { ka: "ყვარელი", en: "Kvareli", lat: 41.9528, lng: 45.8153 },
  { ka: "ახმეტა", en: "Akhmeta", lat: 42.0311, lng: 45.2083 },
  { ka: "ლაგოდეხი", en: "Lagodekhi", lat: 41.8256, lng: 46.2761 },
  { ka: "წნორი", en: "Tsnori", lat: 41.6203, lng: 45.9683 },
  { ka: "დედოფლისწყარო", en: "Dedoplistskaro", lat: 41.4644, lng: 46.1081 },
  { ka: "ლანჩხუთი", en: "Lanchkhuti", lat: 42.0906, lng: 42.0347 },
  { ka: "დუშეთი", en: "Dusheti", lat: 42.0856, lng: 44.6975 },
  { ka: "საჩხერე", en: "Sachkhere", lat: 42.3461, lng: 43.4131 },
  { ka: "თერჯოლა", en: "Terjola", lat: 42.1958, lng: 42.9911 },
  { ka: "ამბროლაური", en: "Ambrolauri", lat: 42.5203, lng: 43.1517 },
  { ka: "ონი", en: "Oni", lat: 42.5817, lng: 43.4458 },
  { ka: "მესტია", en: "Mestia", lat: 43.0456, lng: 42.7281 },
  { ka: "ბაკურიანი", en: "Bakuriani", lat: 41.7500, lng: 43.5333 },
  { ka: "გუდაური", en: "Gudauri", lat: 42.4794, lng: 44.4756 },
  { ka: "სიღნაღი", en: "Sighnaghi", lat: 41.6214, lng: 45.9219 },
  { ka: "წალკა", en: "Tsalka", lat: 41.5947, lng: 44.0908 },
  { ka: "თეთრიწყარო", en: "Tetritskaro", lat: 41.5472, lng: 44.4661 },
  { ka: "ქარელი", en: "Kareli", lat: 42.0197, lng: 43.8994 },
  { ka: "ვანი", en: "Vani", lat: 42.0814, lng: 42.5169 },
  { ka: "მარტვილი", en: "Martvili", lat: 42.4147, lng: 42.3789 },
  { ka: "ცაგერი", en: "Tsageri", lat: 42.6444, lng: 42.7647 },
  { ka: "აბაშა", en: "Abasha", lat: 42.2019, lng: 42.2036 },
];

/** The city whose name this is, in either language, or null. */
export function findCity(name: string): City | null {
  const wanted = name.trim().toLowerCase();
  return GEORGIAN_CITIES.find((city) => city.ka === wanted || city.en.toLowerCase() === wanted) ?? null;
}

/** Cities whose name begins with what was typed, in either language. */
export function suggestCities(typed: string, locale: "ka" | "en", limit = 6): City[] {
  const q = typed.trim().toLowerCase();
  if (!q) return [];
  const starts = (city: City) =>
    city.ka.startsWith(q) || city.en.toLowerCase().startsWith(q);
  const contains = (city: City) =>
    !starts(city) && (city.ka.includes(q) || city.en.toLowerCase().includes(q));
  // The ones that begin with it first, alphabetically, then the ones that
  // merely contain it — "თ" is Tbilisi before Batumi.
  const byName = (a: City, b: City) =>
    locale === "ka" ? a.ka.localeCompare(b.ka, "ka") : a.en.localeCompare(b.en);
  return [
    ...GEORGIAN_CITIES.filter(starts).sort(byName),
    ...GEORGIAN_CITIES.filter(contains).sort(byName),
  ].slice(0, limit);
}
