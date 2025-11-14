import fs from "node:fs"
import bencode from 'bencode'
import dgram from 'node:dgram'
import dns from 'dns'
import { bufferToEncoding, generateInfoHash, getDNS, getPiecesArr } from "./lib/utils.js"

try {
    const data = fs.readFileSync('./test2.torrent')
    const res = bencode.decode(data)

    // Get tracker url
    const trackerUrl = bufferToEncoding(res['announce'], 'utf8')
    const hostName = new URL(trackerUrl).hostname

    // Calculate infohash
    const infoHash = generateInfoHash(res['info'])

    // Extract pieces SHA1 array
    const piecesObj = res['info']['pieces']
    const pieces = getPiecesArr(piecesObj)

    const serverAddress = await getDNS(hostName)

    const server = dgram.createSocket('udp4');

    const serverPort = 6969;

    const buf = Buffer.alloc(16)
    buf.writeBigUInt64BE(0x41727101980n, 0)
    buf.writeUInt32BE(0, 8)

    const transactionId = Math.floor(Math.random() * 0xffffffff);
    buf.writeUInt32BE(transactionId, 12);

    server.send(buf, 0, buf.length, serverPort, serverAddress, (err) => {
        if (err) console.error('Send error:', err);
        else console.log('Connect request sent');
    });

    server.on('message', (res, rinfo) => {
        console.log('res', res, rinfo)
    });


    setInterval(() => { }, 1000)
} catch (err) {
    console.error(err);
}