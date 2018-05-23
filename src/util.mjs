const EMPTY = {}

export function match (url, route, opts = EMPTY) {
  const reg = /(?:\?([^#]*))?(#.*)?$/
  const c = url.match(reg)
  const matches = {}
  let ret

  if (c && c[1]) {
    const p = c[1].split('&')
    for (let i = 0; i < p.length; i++) {
      const r = p[i].split('=')
      matches[decodeURIComponent(r[0])] = decodeURIComponent(r.slice(1).join('='))
    }
  }

  url = segmentize(url.replace(reg, ''))
  route = segmentize(route || '')

  const max = Math.max(url.length, route.length)

  for (let i = 0; i < max; i++) {
    if (route[i] && route[i].charAt(0) === ':') {
      // eslint-disable-next-line
      const param = route[i].replace(/(^\:|[+*?]+$)/g, '')
      const flags = (route[i].match(/[+*?]+$/) || EMPTY)[0] || ''
      const plus = ~flags.indexOf('+')
      const star = ~flags.indexOf('*')
      const val = url[i] || ''

      if (!val && !star && (flags.indexOf('?') < 0 || plus)) {
        ret = false
        break
      }

      matches[param] = decodeURIComponent(val)

      if (plus || star) {
        matches[param] = url.slice(i).map(decodeURIComponent).join('/')
        break
      }
    } else if (route[i] !== url[i]) {
      ret = false
      break
    }
  }
  if (opts.default !== true && ret === false) return false
  return matches
}

export function getCurrentUrl () {
  const url = typeof location !== 'undefined' ? location : EMPTY

  return `${url.pathname || ''}${url.search || ''}`
}

export function pathRankSort (a, b) {
  a = a.path
  b = b.path
  // let aAttr = a.attributes || EMPTY,
  //  bAttr = b.attributes || EMPTY;
  // if (aAttr.default) return 1;
  // if (bAttr.default) return -1;
  const diff = rank(a) - rank(b)
  return diff || (a.length - b.length)
}

export function segmentize (url) {
  return strip(url).split('/')
}

export function rank (url) {
  return (strip(url).match(/\/+/g) || '').length
}

export function strip (url) {
  return url.replace(/(^\/+|\/+$)/g, '')
}
