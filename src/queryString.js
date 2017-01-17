import { reduce } from 'lowline';

export function stringify(obj) {
  return reduce(obj, (result, value, key) => {
    if (result) result += '&';

    return result += `${encodeURIComponent(key)}=${encodeURIComponent(value).replace('%20', '+')}`;
  }, '');
}

export function parse(string) {
  const result = {};

  string.replace(/\+/g, ' ').split('&').forEach((key) => {
    const index = key.indexOf('=');
    let val = '';

    if (index >= 0) {
      val = decodeURIComponent(key.slice(index + 1));
      key = key.slice(0, index);
    }
    if (!key) return;

    key = decodeURIComponent(key);

    // brackets notation for array value
    if (key.slice(-2) === '[]') {
      key = key.slice(0, -2);
      val = [val];
    }

    // if there are multiple values per key, concatenate
    result[key] = key in result ? [].concat(result[key], val) : val;
  });

  return result;
}
