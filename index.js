import fs from 'node:fs';
import {
  getDNS,
  readTorrentData,
  requestAnnounceWithTimeout,
} from './lib/utils.js';
import { Tracker } from './core/Tracker.js';
import { Peer } from './core/Peer.js';
import { Pieces } from './core/Pieces.js';
import { PeerPool } from './core/PeerPool.js';
import { SERVER_PORT } from './constants/consts.js';

try {
  const data = fs.readFileSync('./test.torrent');

  const { totalFileLength, infoHash, pieceLength, pieces, udpTrackers } = readTorrentData(data);

  const peerPool = new PeerPool();

  const globalPieces = new Pieces(peerPool, pieces.length, pieceLength, totalFileLength);

  for (let i = 0; i < udpTrackers.length; i++) {
    const trackerUrl = udpTrackers[i];

    try {
      const hostName = new URL(trackerUrl).hostname;
      const serverAddress = await getDNS(hostName);

      const tracker = new Tracker(serverAddress, SERVER_PORT, infoHash, totalFileLength);

      const res = await requestAnnounceWithTimeout(tracker);

      for (const peer of res.peers) {
        peerPool.addPeer({ ip: peer.ip, port: peer.port, lastTried: null });
        handleNewPeer();
      }
    } catch (e) {
      // console.error("Tracker error:", e);
    }
  }

  // Fired when new peer added
  // Active peers less than 40 && Connect peer
  function handleNewPeer() {
    const connectedPeers = peerPool.getNumberOfconnectedPeers();

    if (connectedPeers < 40) {
      const peer = peerPool.getPeer();
      const { ip, port } = peer;

      function handleConnectionSuccess() {
        peerPool.addConnectedPeer(peer);
      }

      function removeConnectingPeersCallback() {
        peerPool.removePeer(peer);
        peerPool.removeFromPeerDetailsMap(ip, port)

        if (peerPool.getNumberOfconnectedPeers() < 40) {
          handleNewPeer();
        }
      }

      function handleAddBitfield(bitfield) {
        peerPool.addBitfieldToPeerMap(ip, port, bitfield)
      }

      const socketInstance = new Peer(
        ip,
        port,
        infoHash,
        globalPieces,
        removeConnectingPeersCallback,
        handleConnectionSuccess,
        handleAddBitfield,
        pieceLength,
        totalFileLength
      );

      peerPool.addToPeerDetailsMap(ip, port, socketInstance)
    }
  }

  setInterval(() => {}, 1000);
} catch (err) {
  console.error(err);
}
