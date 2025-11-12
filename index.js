import fs from "node:fs"
import bencode from 'bencode'
import crypto from 'crypto'

try {
    const data = fs.readFileSync('./test2.torrent')
    const res = bencode.decode(data)

    const bencoded = bencode.encode(res['info'])

    const hash = crypto.createHash('sha1');
    hash.update(bencoded)
    const hashed = hash.digest('hex')
    console.log(hashed)

} catch (err) {
    console.error(err);
}