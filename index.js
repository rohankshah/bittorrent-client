const fs = require('node:fs');
const { parseMetadata } = require('./utils/parseMetaData');
const { encode } = require('./utils/encode');
const crypto = require('crypto');

try {
    const data = fs.readFileSync('./test2.torrent')
    const res = parseMetadata(data)

    const bencoded = encode(res['value']['info'])

    const hash = crypto.createHash('sha1');
    hash.update(bencoded)
    const hashed = hash.digest('hex')
    console.log(hashed)

} catch (err) {
    console.error(err);
}