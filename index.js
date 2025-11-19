import fs from "node:fs"
import bencode from 'bencode'
import { generateInfoHash, getDNS, getFirstRelevantTracker, getPiecesArr } from "./lib/utils.js"
import { UDP_Protocol } from "./udp_protocol.js"
import { Peer_Protocol } from "./peer_protocol.js"

try {
    const data = fs.readFileSync('./test.torrent')
    const res = bencode.decode(data)

    const totalFileLength = res['info']['files']?.reduce((total, curr) => total + curr?.length, 0)

    const trackerUrl = getFirstRelevantTracker(res)

    // Get tracker url
    // const trackerUrl = bufferToEncoding(res['announce'], 'utf8')
    const hostName = new URL(trackerUrl).hostname

    // Calculate infohash
    const infoHash = generateInfoHash(res['info'])

    // Extract pieces SHA1 array
    const piecesObj = res['info']['pieces']
    const pieces = getPiecesArr(piecesObj)

    console.log('piecesLength', pieces.length)

    const serverAddress = await getDNS(hostName)

    const serverPort = 6969;

    // Send announce request
    const udpServer = new UDP_Protocol(serverAddress, serverPort, infoHash, totalFileLength)

    // Get peer list and send handshake
    udpServer.onAnnounce = (res) => {
        const peers = res['peers']
        for (let i = 0; i < peers.length; i++) {
            const ip = res['peers'][i]['ip']
            const port = res['peers'][i]['port']

            const socketInstance = new Peer_Protocol(ip, port, infoHash)
            socketInstance.TCPHandshake()
        }
    }
    udpServer.connectRequest()

    setInterval(() => { }, 1000)
} catch (err) {
    console.error(err);
}