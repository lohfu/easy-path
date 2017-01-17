import { omit, reduce } from 'lowline';

const EMPTY = {};

export function match(url, route, opts=EMPTY) {
	let reg = /(?:\?([^#]*))?(#.*)?$/,
		c = url.match(reg),
		matches = {},
		ret;
	if (c && c[1]) {
		let p = c[1].split('&');
		for (let i=0; i<p.length; i++) {
			let r = p[i].split('=');
			matches[decodeURIComponent(r[0])] = decodeURIComponent(r.slice(1).join('='));
		}
	}
	url = segmentize(url.replace(reg, ''));
	route = segmentize(route || '');
	let max = Math.max(url.length, route.length);
	for (let i=0; i<max; i++) {
		if (route[i] && route[i].charAt(0)===':') {
			let param = route[i].replace(/(^\:|[+*?]+$)/g, ''),
				flags = (route[i].match(/[+*?]+$/) || EMPTY)[0] || '',
				plus = ~flags.indexOf('+'),
				star = ~flags.indexOf('*'),
				val = url[i] || '';
			if (!val && !star && (flags.indexOf('?')<0 || plus)) {
				ret = false;
				break;
			}
			matches[param] = decodeURIComponent(val);
			if (plus || star) {
				matches[param] = url.slice(i).map(decodeURIComponent).join('/');
				break;
			}
		}
		else if (route[i]!==url[i]) {
			ret = false;
			break;
		}
	}
	if (opts.default!==true && ret===false) return false;
	return matches;
}

export function parseRoutes(routes, tree = []) {
  return reduce(routes, (result, value, key) => {
    const path = tree.concat(key.slice(1).split('/').filter((value) => !!value));

    const obj = Object.assign({
      path: `/${path.join('/')}`,
    }, omit(value, 'routes'));

    result.push(obj);

    if (value.routes) {
      result.push(...parseRoutes(value.routes, path));
    }

    return result;
  }, []).sort(pathRankSort);
}

export function getCurrentUrl() {
	const url = typeof location!=='undefined' ? location : EMPTY;

	return `${url.pathname || ''}${url.search || ''}`;
}

export function pathRankSort(a, b) {
  a = a.path;
  b = b.path;
	// let aAttr = a.attributes || EMPTY,
	// 	bAttr = b.attributes || EMPTY;
	// if (aAttr.default) return 1;
	// if (bAttr.default) return -1;
	let diff = rank(a) - rank(b);
	return diff || (a.length - b.length);
}

export function segmentize(url) {
	return strip(url).split('/');
}

export function rank(url) {
	return (strip(url).match(/\/+/g) || '').length;
}

export function strip(url) {
	return url.replace(/(^\/+|\/+$)/g, '');
}
