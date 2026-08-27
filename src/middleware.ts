import { NextResponse, type NextRequest } from 'next/server';
import { PATHNAME_HEADER } from '@/lib/public-pages';

/**
 * Tells the render which URL it is rendering.
 *
 * This exists for one line: `<html lang>` in the root layout. The eight
 * public pages take their language from their address (see public-pages.ts),
 * but the root layout sits above every segment that knows the address, and a
 * server component has no way to ask — there is no usePathname on the server,
 * and Next exposes no header carrying it. Middleware is the documented way to
 * put it somewhere getLocale() can read.
 *
 * It does nothing else. No redirect on Accept-Language: sending a visitor
 * somewhere they did not ask for, based on a header, is how a crawler ends up
 * indexing a language nobody chose — and how a reader loses the URL they were
 * given. The link to the other language is offered on the page instead.
 */
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, request.nextUrl.pathname);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  /*
   * Everything except the build output and the generated image routes: those
   * are files, they render no layout, and running this on each of them would
   * be work with no reader.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|opengraph-image).*)'],
};
