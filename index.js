import fs from "node:fs"
import bencode from 'bencode'
import { bufferToEncoding, generateInfoHash, generateRandomString, getDNS, getPiecesArr } from "./lib/utils.js"
import { UDP_Protocol } from "./udp_protocol.js"

try {
    const data = fs.readFileSync('./test.torrent')
    const res = bencode.decode(data)

    const totalFileLength = res['info']['files']?.reduce((total, curr) => total + curr?.length, 0)

    // Get tracker url
    const trackerUrl = bufferToEncoding(res['announce'], 'utf8')
    const hostName = new URL(trackerUrl).hostname

    // Calculate infohash
    const infoHash = generateInfoHash(res['info'])

    // Extract pieces SHA1 array
    const piecesObj = res['info']['pieces']
    const pieces = getPiecesArr(piecesObj)

    const serverAddress = await getDNS(hostName)

    const serverPort = 6969;

    const udpServer = new UDP_Protocol(serverAddress, serverPort, infoHash, totalFileLength)
    udpServer.connectRequest()

    setInterval(() => { }, 1000)
} catch (err) {
    console.error(err);
}