/**
 * Derives a URL-safe slug from a human category name so the client only ever
 * has to supply a `name`. Lower-cases, strips diacritics, and collapses any run
 * of non-alphanumeric characters into a single hyphen.
 */
export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
