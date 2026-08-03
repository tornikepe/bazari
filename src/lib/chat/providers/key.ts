import "server-only";

/**
 * Reading an API key out of the environment, defended against the way keys
 * actually get broken.
 *
 * A key pasted twice into a hosting dashboard arrives with a newline in the
 * middle, and every request then fails with an invalid-header error that says
 * nothing about the cause. That happened to `RESEND_API_KEY` on this project
 * and cost an afternoon; taking the first whitespace-delimited token means it
 * cannot happen again, and the warning names the variable so the next person
 * doesn't have to work it out from a header error.
 */
export function readKey(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;

  const trimmed = raw.trim();
  const first = trimmed.split(/\s+/)[0];
  if (!first) return undefined;

  if (first !== trimmed) {
    console.warn(
      `[chat] ${name} contained whitespace or repeated content — using the first token. Re-add it as a single line.`,
    );
  }
  return first;
}
