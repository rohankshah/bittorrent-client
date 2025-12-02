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

    // let successAmount = 0

    for (let i = 0; i < udpTrackers.length; i++) {
        const trackerUrl = udpTrackers[i]

        // if (successAmount === 2) {
        //     console.log('done')
        //     break
        // }

        try {
            const hostName = new URL(trackerUrl).hostname
            const serverAddress = await getDNS(hostName)

            const udpServer = new UDP_Protocol(serverAddress, serverPort, infoHash, totalFileLength)

            const res = await requestAnnounceWithTimeout(udpServer)

            for (const peer of res.peers) {
                globalPeers.addPeer({ ip: peer.ip, port: peer.port, lastTried: null })
                peerAdded()
            }
            // successAmount += 1
        } catch (e) {
            // console.log()
            e
        }
    }

    // Fired when new peer added
    // Active peers less than 40 && Connect peer

    function peerAdded() {
        const activePeers = globalPeers.getNumberOfActivePeers()

        if (activePeers < 40) {
            const peer = globalPeers.getPeer()
            const {ip, port} = peer

            function removeActivePeerCallback() {
                globalPeers.removeActivePeer(peer)
                // console.log(globalPeers.getNumberOfActivePeers())

                const newActivePeers = globalPeers.getNumberOfActivePeers()
                if (newActivePeers < 40) {
                    peerAdded()
                }
            }

            const socketInstance = new Peer_Protocol(ip, port, infoHash, globalPieces, removeActivePeerCallback)
            socketInstance.TCPHandshake()

            globalPeers.addActivePeer(peer)
        }
    }

    // eventEmitter.on('peer-added', peerAdded)

    // const peersCheckInterval = setInterval(() => {
    //     if (globalPeers.isNewPeerAvailable()) {
    //         const {ip, port} = globalPeers.getPeer()

    //         const socketInstance = new Peer_Protocol(ip, port, infoHash, globalPieces)
    //         socketInstance.TCPHandshake()

    //         // Do until 40 or so peers
    //         // 1. Get a peer
    //         // 2. Run the whole peer protocol mechanism
    //         // 3. Check if another peer exists. Move index there
    //     }
    // }, [50])

    // Get tracker url
    // const trackerUrl = bufferToEncoding(res['announce'], 'utf8')
    // const hostName = new URL(trackerUrl).hostname

    // const serverAddress = await getDNS(hostName)

    // // Send announce request
    // const udpServer = new UDP_Protocol(serverAddress, serverPort, infoHash, totalFileLength)

    // // Get peer list and send handshake
    // udpServer.onAnnounce = (res) => {
    //     const peers = res['peers']
    //     for (let i = 0; i < peers.length; i++) {
    //         const ip = res['peers'][i]['ip']
    //         const port = res['peers'][i]['port']

    //         const socketInstance = new Peer_Protocol(ip, port, infoHash, globalPieces)
    //         socketInstance.TCPHandshake()
    //     }
    // }
    // udpServer.connectRequest()

    setInterval(() => { }, 1000)
} catch (err) {
    console.error(err);
}