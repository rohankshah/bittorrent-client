import fs from "node:fs"
import bencode from 'bencode'
import { generateInfoHash, getDNS, getFirstRelevantTracker, getPiecesArr } from "./lib/utils.js"
import { UDP_Protocol } from "./core/udp_protocol.js"
import { Peer_Protocol } from "./core/peer_protocol.js"
import { Pieces } from "./core/pieces.js"

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
    const pieceLength = res['info']['piece length']
    const pieces = getPiecesArr(piecesObj)

    const serverAddress = await getDNS(hostName)

    const serverPort = 6969;

    // Send announce request
    const udpServer = new UDP_Protocol(serverAddress, serverPort, infoHash, totalFileLength)

    const globalPieces = new Pieces(pieces.length, pieceLength, totalFileLength)

    // Get peer list and send handshake
    udpServer.onAnnounce = (res) => {
        const peers = res['peers']
        for (let i = 0; i < peers.length; i++) {
            const ip = res['peers'][i]['ip']
            const port = res['peers'][i]['port']

            const socketInstance = new Peer_Protocol(ip, port, infoHash, globalPieces)
            socketInstance.TCPHandshake()
        }
    }
    udpServer.connectRequest()

    setInterval(() => { }, 1000)
} catch (err) {
    console.error(err);
}