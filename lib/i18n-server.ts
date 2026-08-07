import 'server-only'
import { cookies } from 'next/headers'
import { LANG_COOKIE, DEFAULT_LANG, isLang, type Lang } from '@/lib/i18n'

/**
 * The UI language for this request, from the cookie. Server components and the
 * root layout use this; client components read it from the I18nProvider so both
 * agree and there is no hydration flash.
 *
 * `server-only` guarantees this never gets bundled into the client (it uses
 * next/headers). Reading a cookie makes a route dynamic — every page that shows
 * chrome is already force-dynamic, so nothing regresses.
 */
export function getLang(): Lang {
  const v = cookies().get(LANG_COOKIE)?.value
  return isLang(v) ? v : DEFAULT_LANG
}
