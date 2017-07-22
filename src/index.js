import { pick } from 'lowline'
import * as qs from 'mini-qs'
// eslint-disable-next-line
import { getCurrentUrl, match, pathRankSort } from './util'

const ROUTERS = []

/*
 * @return Result of goTo, which is a promise if at least on router
 * can executed, undefined otherwise
 */
function routeFromLink (node) {
  // only valid elements
  if (!node || !node.getAttribute) return

  const href = node.getAttribute('href')
  const target = node.getAttribute('target')

  // ignore links with targets and non-path URLs
  if (!href || !href.match(/^\//g) || target) return

  return goTo({ url: href, run: true })
}

function prevent (e) {
  if (e) {
    if (e.stopImmediatePropagation) e.stopImmediatePropagation()
    if (e.stopPropagation) e.stopPropagation()
    e.preventDefault()
  }
  return false
}

function delegateLinkHandler (e) {
  // ignore events the browser takes care of already:
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return

  let t = e.target

  do {
    if (String(t.nodeName).toUpperCase() === 'A' && t.getAttribute('href')) {
      if (e.button !== 0) return

      // if link is handled by the router, prevent browser defaults
      if (routeFromLink(t)) {
        return prevent(e)
      }
    }
  } while ((t = t.parentNode))
}

export function setUrl (url, state = null, type = 'push') {
  if (typeof history !== 'undefined' && history[`${type}State`]) {
    history[`${type}State`](state, null, url)
  }
}

/*
 * Use setUrl to store data to history.state
 */
export function store (data) {
  setUrl(getCurrentUrl(), Object.assign({}, window.history.state, data), 'replace')
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
export function goTo ({ query, href, path, pathname, url, search, run = true, replace }) {
  url = url || href

  if (!url) {
    if (!path) {
      pathname = pathname || window.location.pathname

      if (!search) {
        if (!query) {
          return console.error('You have to pass at least one of the following: url, path, search or query')
        } else if (query !== 'string') {
          query = qs.stringify(query)
        }

        search = query ? `?${query}` : ''
      }

      url = pathname + search
    } else {
      url = path
    }
  } else {
    const hostname = `${window.location.protocol}//${window.location.host}`

    if (url.startsWith(hostname)) {
      url = url.slice(hostname.length)
    }
  }

  const routers = ROUTERS.filter((router) => router.canRoute(url))

  if (routers.length) {
    return Promise.all(routers.map((router) => router.exec(url, run))).then(([ctx]) => {
      setUrl(ctx.url, null, replace ? 'replace' : 'push')
    })
  }
}

export class Router {
  constructor (options) {
    if (options.scrollRestoration && window.history.scrollRestoration) window.history.scrollRestoration = options.scrollRestoration

    Object.assign(this, pick(options, 'canRoute', 'context', 'realm', 'remember', 'root'))

    if (this.root) {
      if (!this.root.startsWith('/')) {
        this.root = `/${this.root}`
      }

      if (this.root.endsWith('/')) {
        this.root = this.root.slice(0, 1)
      }
    }

    this.layers = []

    // TODO where should this be? should it even be in the Router class?
    if (typeof addEventListener === 'function') {
      if (options.popstate) {
        addEventListener('popstate', options.popstate)
      } else if (options.popstate !== false) {
        addEventListener('popstate', () => {
          this.exec(getCurrentUrl(), true)
        })
      }

      addEventListener('click', delegateLinkHandler)
    }

    ROUTERS.push(this)
  }

  exec (url, run = false, reload = false) {
    if (!this._listening || (!reload && this.current && this.current.url === url)) return

    return (this.context ? this.context(url) : Promise.resolve({
      url: url,
      body: {},
      state: {},
    })).then((ctx) => {
      const url = this.root ? ctx.url.slice(this.root.length) : ctx.url

      const stack = this.layers.reduce((result, [ path, fnc ]) => {
        const obj = {
          fnc,
        }

        if (!path) {
          result.push(obj)
        } else {
          const params = match(url, path)

          if (params) {
            obj.params = params
            result.push(obj)
          }
        }

        return result
      }, [])

      if (!stack.length) return Promise.reject(new Error('No matching route'))

      return new Promise((resolve, reject) => {
        function next (err) {
          if (err) return reject(err)

          if (stack.length) {
            const layer = stack.shift()

            ctx.params = layer.params || {}

            return layer.fnc(ctx, next)
          }

          resolve(ctx)
        }

        next()
      })
    })
  }

  canRoute (url) {
    return this._listening && (!this.realm || this.realm.test(url))
  }

  use (path, ...fncs) {
    if (typeof path === 'function') {
      fncs.unshift(path)
      path = null
    }

    fncs.forEach((fnc) => {
      this.layers.push([ path, fnc ])
    })
  }

  start (options = {}) {
    this._listening = true

    if (options.trigger) {
      if (this.remember) {
        store(this.remember())
      }

      return this.exec(options.url || getCurrentUrl(), options.run)
    }

    return Promise.resolve()
  }

  stop () {
    this._listening = false
  }

  destroy () {
    // this.stop()
    const index = ROUTERS.indexOf(this)

    if (index > -1) {
      ROUTERS.splice(index, 1)
    }

    if (typeof removeEventListener === 'function') {
      removeEventListener('click', delegateLinkHandler)
    }
  }
}
