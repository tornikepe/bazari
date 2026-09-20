import { redirect } from "next/navigation";

/** The old settings page: its parts are the account card and the addresses now. */
export default function AccountSettingsPage() {
  redirect("/account");
}
