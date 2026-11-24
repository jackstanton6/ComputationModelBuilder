// Minimal Worker. Static assets (with _headers and _redirects in dist/) are served before this
// runs; it only sees requests that match no asset, and hands them back to the asset handler so
// the 404 page is used. Having a script guarantees the zone route binds.
interface Env { ASSETS: { fetch(req: Request): Promise<Response> } }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/cmb') {
      url.pathname = '/cmb/';
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
