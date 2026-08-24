"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";

/**
 * An offer to install the shop, made once and only where it can be accepted.
 *
 * Deliberately not a banner. A bar that slides over the catalogue asking to be
 * installed is asking a stranger to commit to a shop they have not bought
 * anything from yet, and it does it while covering the products — which is the
 * behaviour that taught everyone to dismiss these without reading them. This
 * sits in the footer, where somebody who has read to the bottom of the page
 * will find it, and nowhere else.
 *
 * It renders nothing at all unless the browser says installing is possible.
 * That is not a nicety: Safari fires no `beforeinstallprompt` and installs
 * through its own Share menu instead, and a button that did nothing on iOS
 * would be worse than no button. So the event *is* the condition, and a
 * browser that cannot install simply never sees this.
 */

/** Not in `lib.dom`: still a Chromium extension rather than a standard. */
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const { t } = useI18n();
  const [offer, setOffer] = useState<InstallEvent | null>(null);

  useEffect(() => {
    function held(event: Event) {
      // Chromium shows its own bar unless this is called, and its bar is the
      // one that covers the page.
      event.preventDefault();
      setOffer(event as InstallEvent);
    }

    // Already installed, or installed in another tab: the offer is spent.
    function installed() {
      setOffer(null);
    }

    window.addEventListener("beforeinstallprompt", held);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", held);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!offer) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        // One shot: the event cannot be used twice, so it goes whatever the
        // reader answers. Saying no to an offer should not leave it on screen.
        setOffer(null);
        await offer.prompt();
      }}
      className="text-xs font-semibold text-ink-500 underline underline-offset-4 transition-colors hover:text-brand-600"
    >
      {t.footer.install}
    </button>
  );
}
