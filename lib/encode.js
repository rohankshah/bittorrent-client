export function encode(data) {
  let res = '';

  if (Buffer.isBuffer(data)) {
    return `${data.byteLength}:${data.toString('binary')}`;
  }

  if (typeof data === 'number') {
    res += 'i' + data + 'e';
    return res;
  }

  if (typeof data === 'string') {
    res += Buffer.from(data).byteLength + ':' + data;
    return res;
  }

  if (typeof data === 'string') {
    const byteLen = Buffer.byteLength(data, 'utf8');
    return `${byteLen}:${data}`;
  }

  if (Array.isArray(data)) {
    res += 'l';
    for (let i = 0; i < data.length; i++) {
      const encodedVal = encode(data[i]);
      res += encodedVal;
    }
    res += 'e';
    return res;
  }

  if (typeof data === 'object') {
    res += 'd';
    const keys = Object.keys(data).sort();
    for (const key of keys) {
      const keyRes = encode(key);
      const valRes = encode(data[key]);

      res += keyRes + valRes;
    }
    res += 'e';
    return res;
  }
}
