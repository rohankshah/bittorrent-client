import fs from "node:fs"
import bencode from 'bencode'
import { generateInfoHash, getAllTrackers, getDNS, getPiecesArr, requestAnnounceWithTimeout } from "./lib/utils.js"
import { UDP_Protocol } from "./core/udp_protocol.js"
import { Peer_Protocol } from "./core/peer_protocol.js"
import { Pieces } from "./core/pieces.js"
import { Peers } from "./core/peers.js"

const serverPort = 6969;

try {
    const data = fs.readFileSync('./test.torrent')
    const res = bencode.decode(data)

    const totalFileLength = res['info']['files']?.reduce((total, curr) => total + curr?.length, 0)

    // Calculate infohash
    const infoHash = generateInfoHash(res['info'])

    // Extract pieces SHA1 array
    const piecesObj = res['info']['pieces']
    const pieceLength = res['info']['piece length']
    const pieces = getPiecesArr(piecesObj)

    const trackerArr = getAllTrackers(res)

    const globalPeers = new Peers()

    const globalPieces = new Pieces(pieces.length, pieceLength, totalFileLength)

    const udpTrackers = trackerArr.filter(url => url.startsWith("udp://"))

    for (let i = 0; i < udpTrackers.length; i++) {
        const trackerUrl = udpTrackers[i]

        try {
            const hostName = new URL(trackerUrl).hostname
            const serverAddress = await getDNS(hostName)

            const udpServer = new UDP_Protocol(serverAddress, serverPort, infoHash, totalFileLength)

            const res = await requestAnnounceWithTimeout(udpServer)

            for (const peer of res.peers) {
                globalPeers.addPeer({ ip: peer.ip, port: peer.port, lastTried: null })
                peerAdded()
            }
        } catch (e) {
            e
        }
    }

    // Fired when new peer added
    // Active peers less than 40 && Connect peer
    function peerAdded() {
        const activePeers = globalPeers.getNumberOfconnectingPeers()

        if (activePeers < 40) {
            const peer = globalPeers.getPeer()
            const { ip, port } = peer

            function handleConnectionSuccess() {
                globalPeers.addConnectedPeer(peer)
            }

            function removeConnectingPeersCallback() {
                globalPeers.removePeer(peer)
                // console.log(globalPeers.getNumberOfconnectingPeers())

                const newActivePeers = globalPeers.getNumberOfconnectingPeers()
                if (newActivePeers < 40) {
                    peerAdded()
                }
            }

            const socketInstance = new Peer_Protocol(ip, port, infoHash, globalPieces, removeConnectingPeersCallback, handleConnectionSuccess, totalFileLength)
            socketInstance.TCPHandshake()

            globalPeers.addConnectingPeer(peer)
        }
    }

    setInterval(() => { }, 1000)
} catch (err) {
    console.error(err);
}