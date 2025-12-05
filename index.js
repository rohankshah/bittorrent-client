import fs from 'node:fs';
import {
  getDNS,
  readTorrentData,
  requestAnnounceWithTimeout,
} from './lib/utils.js';
import { UDP_Protocol } from './core/udp_protocol.js';
import { Peer_Protocol } from './core/peer_protocol.js';
import { Pieces } from './core/pieces.js';
import { Peers } from './core/peers.js';
import { SERVER_PORT } from './constants/consts.js';

try {
  const data = fs.readFileSync('./test.torrent');

  const { totalFileLength, infoHash, pieceLength, pieces, udpTrackers } = readTorrentData(data);

  const globalPeers = new Peers();

  const globalPieces = new Pieces(pieces.length, pieceLength, totalFileLength);

  for (let i = 0; i < udpTrackers.length; i++) {
    const trackerUrl = udpTrackers[i];

    try {
      const hostName = new URL(trackerUrl).hostname;
      const serverAddress = await getDNS(hostName);

      const udpServer = new UDP_Protocol(serverAddress, SERVER_PORT, infoHash, totalFileLength);

      const res = await requestAnnounceWithTimeout(udpServer);

      for (const peer of res.peers) {
        globalPeers.addPeer({ ip: peer.ip, port: peer.port, lastTried: null });
        handleNewPeer();
      }
    } catch (e) {
      // console.error("Tracker error:", e);
    }
  }

  // Fired when new peer added
  // Active peers less than 40 && Connect peer
  function handleNewPeer() {
    const connectedPeers = globalPeers.getNumberOfconnectedPeers();

    if (connectedPeers < 40) {
      const peer = globalPeers.getPeer();
      const { ip, port } = peer;

      function handleConnectionSuccess() {
        globalPeers.addConnectedPeer(peer);
      }

      function removeConnectingPeersCallback() {
        globalPeers.removePeer(peer);

        if (globalPeers.getNumberOfconnectedPeers() < 40) {
          handleNewPeer();
        }
      }

      const socketInstance = new Peer_Protocol(
        ip,
        port,
        infoHash,
        globalPieces,
        removeConnectingPeersCallback,
        handleConnectionSuccess,
        pieceLength,
        totalFileLength
      );
    }
  }

  setInterval(() => {}, 1000);
} catch (err) {
  console.error(err);
}
