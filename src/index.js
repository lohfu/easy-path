import { pick } from 'lowline';
import * as qs from 'mini-qs';
import { getCurrentUrl, match, parseRoutes, pathRankSort } from './util';

const ROUTERS = [];

/*
 * @return Result of goTo, which is a promise if at least on router
 * can executed, undefined otherwise
 */
function routeFromLink(node) {
  // only valid elements
  if (!node || !node.getAttribute) return;

  const href = node.getAttribute('href');
  const target = node.getAttribute('target');

  // ignore links with targets and non-path URLs
  if (!href || !href.match(/^\//g) || target) return;

  return goTo({ url: href, run: true });
}

function prevent(e) {
  if (e) {
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    if (e.stopPropagation) e.stopPropagation();
    e.preventDefault();
  }
  return false;
}

function delegateLinkHandler(e) {
  // ignore events the browser takes care of already:
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

  let t = e.target;

  do {
    if (String(t.nodeName).toUpperCase() === 'A' && t.getAttribute('href')) {
      if (e.button !== 0) return;

      // if link is handled by the router, prevent browser defaults
      if (routeFromLink(t)) {
        return prevent(e);
      }
    }
  } while ((t = t.parentNode));
}

function setUrl(url, state = null, type = 'push') {
  if (typeof history !== 'undefined' && history[`${type}State`]) {
    history[`${type}State`](state, null, url);
  }
}

/*
 * Use setUrl to store data to history.state
 */
export function store(data) {
  setUrl(getCurrentUrl(), Object.assign({}, window.history.state, data), 'replace');
}

/*
 * precedence
 *
 * 1. url
 * 2. path
 * 3. (pathname || window.location.pathname) + search
 * 4. (pathname || window.location.pathname) + '?' + query
 *
 * ie you cannot only pass `pathname`, you have to pass `search` and `query`.
 * if you want to go to a `pathname` without a `search` or `query` pass `path` instead
 */
export function goTo({ query, href, path, pathname, url, search, run = true, replace }) {
  url = url || href;

  if (!url) {
    if (!path) {
      pathname = pathname || window.location.pathname;

      if (!search) {
        if (!query) {
          return console.error('You have to pass at least one of the following: url, path, search or query');
        } else if (query !== 'string') {
          query = qs.stringify(query);
        }

        search = query ? `?${query}` : '';
      }

      url = pathname + search;
    } else {
      url = path;
    }
  }

  const routers = ROUTERS.filter((router) => {
    if (router.canRoute(url)) {
      if (!replace && router.remember) store(router.remember());

      return true;
    }
    return false;
  });

  if (routers.length) {
    setUrl(url, null, replace ? 'replace' : 'push');

    if (routers.length === 1) return routers[0].exec(url, run);

    return Promise.all(routers.map((router) => router.exec(url, run)));
  }
}


export class Router {
  constructor(options) {
    if (options.scrollRestoration && window.history.scrollRestoration) window.history.scrollRestoration = options.scrollRestoration;

    Object.assign(this, pick(options, 'finish', 'remember', 'pre', 'post', 'root'));

    if (this.root && !this.root.startsWith('/')) this.root = `/${this.root}`;

    if (!options.routes) {
      throw new Error('No routes provided');
    } else if (Array.isArray(options.routes)) {
      this.routes = options.routes;
    } else {
      // TODO throw error if non compatible routes object
      this.routes = parseRoutes(options.routes, this.root ? this.root.split('/').slice(1) : []).sort(pathRankSort);
    }

    if (typeof addEventListener === 'function') {
      if (options.popstate) {
        addEventListener('popstate', options.popstate);
      } else if (options.popstate !== false) {
        addEventListener('popstate', () => {
          this.exec(getCurrentUrl(), true);
        });
      }

      addEventListener('click', delegateLinkHandler);
    }

    ROUTERS.push(this);
  }

  exec(url, run = false, reload = false) {
    if (!this._listening || (!reload && this.current && this.current.url === url)) return;

    const match = this.getMatchingRoute(url);

    if (!match) return Promise.reject('No matching route');

    const { params, route } = match;

    const ctx = this.current = Object.assign({ url, state: window.history.state, params }, route);

    let mw = [];

    if (run) {
      if (this.pre) mw = mw.concat(this.pre);
      if (route.mw) mw = mw.concat(route.mw);
      if (this.post) mw = mw.concat(this.post);
    }

    if (route.finish || this.finish) mw = mw.concat(route.finish || this.finish);

    return new Promise((resolve, reject) => {
      function next(err) {
        if (err) return reject(err);

        if (mw.length) return mw.shift()(ctx, next);

        resolve(ctx);
      }

      next();
    });
  }

  /** Check if the given URL can be matched against any routes */
  canRoute(url) {
    return this._listening && this.routes.some((route) => match(url, route.path));
  }

  /** Re-render children with a new URL to match against. */
  getCurrentRoute() {
    return this.current;
  }

  getMatchingRoute(url) {
    for (let i = 0; i < this.routes.length; i++) {
      const route = this.routes[i];

      const params = match(url, route.path);

      if (params) {
        return Object.assign({ params, route });
      }
    }
  }

  start(options = {}) {
    this._listening = true;

    if (options.trigger) {
      if (this.remember) {
        store(this.remember());
      }

      return this.exec(options.url || getCurrentUrl(), options.run);
    }

    return Promise.resolve();
  }

  stop() {
    this._listening = false;
  }
}
