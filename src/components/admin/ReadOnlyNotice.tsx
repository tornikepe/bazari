"use client";

import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { EyeIcon } from "@/components/ui/icons";

/**
 * Tells a read-only staff member why the buttons are missing.
 *
 * Without this the dashboard just looks broken to them — pages full of data
 * and nothing to press, with no explanation of whether that is the account or
 * a bug. Stated once at the top of the page rather than repeated on every
 * disabled control.
 */
export function ReadOnlyNotice() {
  const { t } = useI18n();
  const canWrite = useCanWrite();

  if (canWrite) return null;

  return (
    <div className="mb-5 flex items-start gap-3 border border-line bg-surface p-4">
      <EyeIcon size={18} className="mt-0.5 shrink-0 text-info" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink-900">{t.admin.readOnlyTitle}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">{t.admin.readOnlyBody}</p>
      </div>
    </div>
  );
}
