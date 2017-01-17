import { getCurrentUrl, match, parseRoutes, pathRankSort } from './util';
import * as qs from './queryString';


let remember = null;
let handler = null;
let finish = null;
let root = null;
let routes = [];
let running = false;
let previousUrl = null;
let currentUrl = null;
let currentRoute = null;

const defaultOptions = {
  routes: [],
}

const EMPTY = {};

function routeFromLink(node) {
	// only valid elements
	if (!node || !node.getAttribute) return;

	let href = node.getAttribute('href'),
		target = node.getAttribute('target');

	// ignore links with targets and non-path URLs
	if (!href || !href.match(/^\//g) || (target && !target.match(/^_?self$/i))) return;

	// attempt to route, if no match simply cede control to browser
	goTo({ url: href }, true);

  return true;
}

function prevent(e) {
	if (e) {
		if (e.stopImmediatePropagation) e.stopImmediatePropagation();
		if (e.stopPropagation) e.stopPropagation();
		e.preventDefault();
	}
	return false;
}

export function delegateLinkHandler(e) {
	// ignore events the browser takes care of already:
	if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

	let t = e.target;
	do {
		if (String(t.nodeName).toUpperCase()==='A' && t.getAttribute('href')) {
			if (e.button !== 0) return;

			// if link is handled by the router, prevent browser defaults
      if (routeFromLink(t)) {
        return prevent(e);
      }
		}
	} while ((t=t.parentNode));
}

export function setUrl(url, state = null, type='push') {
	if (typeof history!=='undefined' && history[type+'State']) {
		history[type+'State'](state, null, url);
	}
}

export function goTo({ query, path, pathname, url, search }, handle, replace) {
  path = path || pathname;

  if (query) {
    if (query !== 'string') {
      query = qs.stringify(query);
    }

    path = path || window.location.pathname;
    search = search || query ? `?${query}` : '';
  } else if (path) {
    search = search || window.location.search;
  }

  url = url || `${path}${search}`;

  if (!replace && remember) {
    const data = remember();
    
    if (data && Object.keys(data).length) setUrl(getCurrentUrl(), Object.assign({}, window.history.state, data), 'replace');
  }

  setUrl(url, null, replace ? 'replace' : 'push');

  exec(url, handle);
}

/** Check if the given URL can be matched against any routes */
export function canRoute(url) {
  const path = url.split('?')[0];

  return running && this.routes.some((route) => match(url, route.path));
}

/** Re-render children with a new URL to match against. */
export function exec(url, handle = false, reload = false) {
  if (!reload && currentRoute && currentRoute.url === url) return;

  previousUrl = currentRoute && currentRoute.url;
  currentUrl = url;

  currentRoute = Object.assign({}, getMatchingRoute(url), {
    url: url,
    query: qs.parse(window.location.search.slice(1)),
    state: history.state,
  });

  const ctx = {
    route: currentRoute,
    state: history.state,
  };

  // const handler = route.handler || (route.noHandler ? null : this.handler);
  const h = handle && (currentRoute.handler || handler);

  if (h) {
    h(ctx, () => {
      if (finish) finish(ctx);
    });
  } else if (finish) {
    finish(ctx);
  }
}

export function getCurrentRoute() {
  return currentRoute;
}

export function getMatchingRoute(url, invoke) {
  // TODO make this smarter, eg check if the url begings with root
  if (root) url = url.slice(root.length);

  for (const key in routes) {
    const route = routes[key];

    const params = match(url, route.path);

    if (params) {
      return Object.assign({ url, params }, route);
    }
  }
}

export function start(options = {}) {
  remember = options.remember;
  handler = options.handler;
  finish = options.finish;
  root = options.root;

  if (!options.routes || Array.isArray(options.routes)) {
    routes = options.routes;
  } else {
    // TODO throw error if non compatible routes object
    routes = parseRoutes(options.routes);
  }

  if (typeof addEventListener==='function') {
    if (options.popstate) {
      addEventListener('popstate', options.popstate);
    } else if (options.popstate !== false) {
      addEventListener('popstate', (e) => {
        exec(getCurrentUrl(), true);
      });
    }

    addEventListener('click', delegateLinkHandler);
  }

  // default handler (optional)

  if (options.exec)
    exec(options.url || getCurrentUrl(), options.handle);
}

export function stop() {
}
