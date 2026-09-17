"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { Overlay } from "@/components/ui/Overlay";
import { loadGoogleMaps, mapsAvailable } from "@/lib/google-maps";
import { CloseIcon, MapPinIcon } from "@/components/ui/icons";

export type Pin = { lat: number; lng: number };

/**
 * A pin on a map, for the courier.
 *
 * A button under the address box opens a map centred on the city typed
 * above it; a tap puts the pin, and the pin can be dragged; confirming
 * hands back the spot and, when the map knows one, the address it stands
 * on — which fills an empty address box. None of it is required: an
 * address in words is enough, and this is for the door the words do not
 * find.
 *
 * Nothing renders without a Maps key; the checkout is the same page
 * without it.
 */
export function MapPicker({
  centre,
  pin,
  onPick,
  onClear,
}: {
  /** Where to open when there is no pin yet — the city, or Tbilisi. */
  centre: Pin;
  pin: Pin | null;
  onPick: (pin: Pin, address: string | null) => void;
  onClear: () => void;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Pin | null>(pin);
  const [address, setAddress] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  // The map is built when the card opens, on the element the card
  // renders, and torn down with it.
  useEffect(() => {
    if (!open || !mapRef.current) return;
    let cancelled = false;
    const start = pin ?? centre;

    loadGoogleMaps(locale)
      .then(async (g) => {
        if (cancelled || !mapRef.current) return;
        const { Map } = (await g.maps.importLibrary("maps")) as google.maps.MapsLibrary;
        const { AdvancedMarkerElement } = (await g.maps.importLibrary(
          "marker",
        )) as google.maps.MarkerLibrary;
        const map = new Map(mapRef.current, {
          center: start,
          zoom: pin ? 17 : 13,
          mapId: "bazari-checkout",
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        geocoderRef.current = new g.maps.Geocoder();

        const place = (at: Pin) => {
          if (!markerRef.current) {
            markerRef.current = new AdvancedMarkerElement({ map, position: at, gmpDraggable: true });
            markerRef.current.addListener("dragend", () => {
              const p = markerRef.current?.position;
              if (!p) return;
              const next = {
                lat: typeof p.lat === "function" ? p.lat() : p.lat,
                lng: typeof p.lng === "function" ? p.lng() : p.lng,
              };
              setDraft(next);
              lookup(next);
            });
          } else {
            markerRef.current.position = at;
          }
          setDraft(at);
          lookup(at);
        };

        const lookup = (at: Pin) => {
          geocoderRef.current
            ?.geocode({ location: at, language: locale })
            .then((result) => {
              const first = result.results[0];
              setAddress(first ? shorten(first.formatted_address) : null);
            })
            .catch(() => setAddress(null));
        };

        map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (event.latLng) place({ lat: event.latLng.lat(), lng: event.latLng.lng() });
        });
        if (pin) place(pin);
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
      markerRef.current = null;
      geocoderRef.current = null;
    };
  }, [open, centre, pin, locale]);

  if (!mapsAvailable()) return null;

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setDraft(pin);
            setAddress(null);
            setFailed(false);
            setOpen(true);
          }}
          className="btn btn-outline btn-sm gap-1.5"
        >
          <MapPinIcon size={15} />
          {pin ? t.checkout.mapChange : t.checkout.mapPick}
        </button>
        {pin && (
          <>
            <span className="text-xs text-success">{t.checkout.mapPinned}</span>
            <button type="button" onClick={onClear} className="text-xs text-ink-500 underline underline-offset-4 hover:text-ink-900">
              {t.checkout.mapClear}
            </button>
          </>
        )}
      </div>

      <Overlay
        open={open}
        onClose={() => setOpen(false)}
        side="center"
        closeLabel={t.nav.close}
        label={t.checkout.mapTitle}
        className="max-w-2xl overflow-hidden bg-surface shadow-pop"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-ink-900">{t.checkout.mapTitle}</h2>
            <p className="text-xs text-ink-500">{t.checkout.mapHint}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t.nav.close}
            className="btn btn-ghost -mr-2 h-9 w-9 rounded-control p-0"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div ref={mapRef} className="h-[60dvh] max-h-[28rem] w-full bg-ink-100">
          {failed && (
            <p className="grid h-full place-items-center px-6 text-center text-sm text-ink-500">
              {t.checkout.mapFailed}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line bg-canvas px-5 py-3.5">
          <p className="min-w-0 flex-1 text-xs text-ink-600">
            {draft ? (address ?? `${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`) : t.checkout.mapNoPin}
          </p>
          <button
            type="button"
            disabled={!draft}
            onClick={() => {
              if (!draft) return;
              onPick(draft, address);
              setOpen(false);
            }}
            className="btn btn-primary btn-md"
          >
            {t.checkout.mapConfirm}
          </button>
        </div>
      </Overlay>
    </>
  );
}

/** "12 Rustaveli Ave, Tbilisi 0108, Georgia" → "12 Rustaveli Ave, Tbilisi". */
function shorten(formatted: string): string {
  return formatted
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !/^(Georgia|საქართველო)$/i.test(part))
    .slice(0, 2)
    .map((part) => part.replace(/\s\d{4}$/, ""))
    .join(", ");
}
