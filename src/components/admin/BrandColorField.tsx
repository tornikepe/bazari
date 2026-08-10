"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { AlertIcon, CheckIcon } from "@/components/ui/icons";
import {
  checkBrandColor,
  deriveBrandTheme,
  DEFAULT_BRAND_COLOR,
  type BrandPairKey,
  type BrandRamp,
  type Theme,
} from "@/lib/brand-theme";

/**
 * The pair names, in the reader's language.
 *
 * `BRAND_PAIRS` carries an English `label` for test output and logs; a shop
 * owner reading a Georgian dashboard must not be told their contrast is lowest
 * on "links on the page".
 */
const PAIR_LABEL: Record<BrandPairKey, (t: ReturnType<typeof useI18n>["t"]) => string> = {
  button: (t) => t.admin.brandPairButton,
  buttonHover: (t) => t.admin.brandPairButtonHover,
  linkCard: (t) => t.admin.brandPairLinkCard,
  linkPage: (t) => t.admin.brandPairLinkPage,
  chip: (t) => t.admin.brandPairChip,
  badge: (t) => t.admin.brandPairBadge,
};

/**
 * Picks the shop's brand colour, and shows what the site will do with it.
 *
 * The preview is the point. One colour turns into twenty-six — thirteen tokens
 * in two themes — and a swatch of the *input* tells the owner nothing about
 * whether their button will be legible. So the derived shades are rendered as
 * the things they become: a button, a link, a badge, in both themes at once,
 * with the measured contrast underneath.
 *
 * The same functions run here and in the server action. That is deliberate: the
 * numbers on screen are the numbers the save is judged by, not a second
 * implementation that can drift from it. The action still re-checks, because
 * this component is a convenience and the action is the rule.
 */
export function BrandColorField({ initial, disabled }: { initial: string; disabled: boolean }) {
  const { t } = useI18n();
  const [value, setValue] = useState(initial);

  // `type="color"` always yields `#rrggbb`; the text field is what lets someone
  // paste a brand hex from a style guide, and that is where nonsense arrives.
  const normalised = value.trim().toLowerCase();
  const check = useMemo(() => checkBrandColor(normalised), [normalised]);
  const theme = useMemo(() => deriveBrandTheme(normalised), [normalised]);

  const suggestion = !check.ok && check.reason === "drift" ? check.suggestion : null;

  const lowest = check.ok
    ? check.audit.reduce((worst, row) => (row.ratio < worst.ratio ? row : worst))
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="field-label" htmlFor="brandColor">
          {t.admin.brandColorField}
        </label>

        <div className="flex items-center gap-2">
          {/* Fixed size on both controls: the swatch and the hex field keep the
              same box in Georgian and English, so nothing reflows on a language
              switch. */}
          <input
            type="color"
            aria-label={t.admin.brandColorField}
            value={/^#[0-9a-f]{6}$/.test(normalised) ? normalised : DEFAULT_BRAND_COLOR}
            onChange={(event) => setValue(event.target.value)}
            disabled={disabled}
            className="h-10 w-12 shrink-0 cursor-pointer border border-field-border bg-surface p-1 disabled:cursor-not-allowed"
          />
          <input
            id="brandColor"
            name="brandColor"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={disabled}
            spellCheck={false}
            maxLength={7}
            // Without these the refusal is a red box near the input rather than
            // something attached to it: a screen reader reaches the field, is
            // told nothing is wrong, and has no route to the explanation.
            aria-invalid={!check.ok}
            aria-describedby={check.ok ? undefined : "brandColor-error"}
            className="field w-32 font-mono"
            style={{ fontVariantNumeric: "tabular-nums" }}
          />
          {!disabled && normalised !== DEFAULT_BRAND_COLOR && (
            <button
              type="button"
              onClick={() => setValue(DEFAULT_BRAND_COLOR)}
              className="btn btn-outline btn-sm"
            >
              {t.admin.brandReset}
            </button>
          )}
        </div>

        <p className="mt-1 text-xs text-ink-400">{t.admin.brandHint}</p>
      </div>

      {theme && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ThemePreview theme="light" ramp={theme.light} label={t.admin.brandPreviewLight} />
          <ThemePreview theme="dark" ramp={theme.dark} label={t.admin.brandPreviewDark} />
        </div>
      )}

      {/* Deliberately not a live region. It updates on every keystroke in the
          hex field, so announcing it would talk over someone typing — and it
          collided with the form's own "Saved" status, which is the message
          that does need announcing. The refusal below is the live one, because
          that is the case where something has to be said. */}
      {check.ok && lowest && (
        <p className="flex items-start gap-1.5 text-xs text-success">
          <CheckIcon size={14} />
          <span>
            {t.admin.brandContrastOk} · {t.admin.brandContrastLowest}{" "}
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{lowest.ratio.toFixed(2)}:1</span> —{" "}
            {PAIR_LABEL[lowest.key](t)}
          </span>
        </p>
      )}

      {!check.ok && (
        <div id="brandColor-error" role="alert" className="border border-danger-soft bg-danger-soft p-3">
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-danger">
            <AlertIcon size={14} />
            <span>
              {check.reason === "invalid"
                ? t.admin.brandInvalid
                : check.reason === "drift"
                  ? t.admin.brandDrift.replace("{suggestion}", suggestion ?? "")
                  : t.admin.brandUnusable}
            </span>
          </p>

          {suggestion && !disabled && (
            <button
              type="button"
              onClick={() => setValue(suggestion)}
              className="btn btn-outline btn-sm mt-2"
            >
              <span
                aria-hidden
                className="mr-1.5 inline-block h-3 w-3 border border-line align-[-1px]"
                style={{ background: suggestion }}
              />
              {t.admin.brandUseSuggestion.replace("{suggestion}", suggestion)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The derived palette shown as the components it becomes.
 *
 * `data-theme` is set on this element rather than inherited, so the dark
 * preview renders dark inside a light dashboard — the owner sees both at once
 * instead of switching themes to check the other half of their decision. The
 * grounds are written as inline values from the ramp rather than as token
 * classes, because token classes here would resolve to the *current* palette,
 * not the one being previewed.
 */
function ThemePreview({ theme, ramp, label }: { theme: Theme; ramp: BrandRamp; label: string }) {
  const ground = theme === "light" ? "#ffffff" : "#14171d";
  const text = theme === "light" ? "#161a23" : "#f4f6fa";

  return (
    <div className="border border-line">
      <p className="border-b border-line px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-ink-400">
        {label}
      </p>

      <div className="flex flex-col gap-2.5 p-3" style={{ background: ground, color: text }}>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex h-8 items-center px-3 text-xs font-semibold"
            style={{ background: ramp["brand-solid"], color: ramp["brand-on-solid"] }}
          >
            {/* Not translated: it is a swatch of a button, not a button. */}
            Aa
          </span>
          <span className="text-xs font-semibold underline" style={{ color: ramp["brand-600"] }}>
            Aa
          </span>
          <span
            className="inline-flex h-6 items-center px-2 text-[0.6875rem] font-bold"
            style={{ background: ramp["brand-50"], color: ramp["brand-700"] }}
          >
            Aa
          </span>
        </div>

        {/* The ramp itself, so a shop owner can see the shades their palette
            gained rather than only the three places they show up. */}
        <div className="flex h-4">
          {(["brand-50", "brand-100", "brand-200", "brand-300", "brand-400", "brand-500", "brand-600", "brand-700", "brand-800", "brand-900"] as const).map(
            (token) => (
              <span key={token} className="flex-1" style={{ background: ramp[token] }} title={token} />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
