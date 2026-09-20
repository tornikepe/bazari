/**
 * The initials a name reduces to.
 *
 * Two letters at most, and the *first letter of each of the first two words* —
 * not the first two characters, which turns "Demo customer" into "DE". Falls
 * back to the address when there is no name, because an account created from a
 * social sign-in may not have one.
 */
export function initialsOf(name: string, email: string): string {
  const source = name.trim() || email.split("@")[0] || "";
  const words = source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2);
  return (
    words
      .map((word) => [...word][0] ?? "")
      .join("")
      .toUpperCase() || "?"
  );
}
