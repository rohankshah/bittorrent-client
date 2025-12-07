import { SERVER_PORT } from '../constants/consts.js';
import { getDNS, requestAnnounceWithTimeout } from '../lib/utils.js';
import { Peer } from './Peer.js';
import { PeerPool } from './PeerPool.js';
import { Pieces } from './Pieces.js';
import { Tracker } from './Tracker.js';

export class TorrentClient {
  constructor({ totalFileLength, infoHash, pieceLength, pieces, udpTrackers }) {
    this.infoHash = infoHash;
    this.totalFileLength = totalFileLength;
    this.pieceLength = pieceLength;
    this.pieces = pieces;
    this.udpTrackers = udpTrackers;

    this.peerPool = new PeerPool();

    this.globalPieces = new Pieces(
      this.peerPool,
      this.pieces.length,
      this.pieceLength,
      this.totalFileLength
    );
  }

  async start() {
    await this.startTrackerAnnounce();
  }

  async startTrackerAnnounce() {
    for (let i = 0; i < this.udpTrackers.length; i++) {
      const trackerUrl = this.udpTrackers[i];

      try {
        const hostName = new URL(trackerUrl).hostname;
        const serverAddress = await getDNS(hostName);

        const tracker = new Tracker(
          serverAddress,
          SERVER_PORT,
          this.infoHash,
          this.totalFileLength
        );

        const res = await requestAnnounceWithTimeout(tracker);

        for (const peer of res.peers) {
          this.peerPool.addPeer({ ip: peer.ip, port: peer.port, lastTried: null });
          this.handleNewPeer();
        }
      } catch (e) {
        // console.error("Tracker error:", e);
      }
    }
  }

  // Fired when new peer added
  // Active peers less than 40 && Connect peer
  handleNewPeer() {
    const connectedPeers = this.peerPool.getNumberOfconnectedPeers();

    if (connectedPeers < 40) {
      const peer = this.peerPool.getPeer();
      const { ip, port } = peer;

      const handleConnectionSuccess = () => {
        this.peerPool.addConnectedPeer(peer);
      };

      const removeConnectingPeersCallback = () => {
        this.peerPool.removePeer(peer);
        this.peerPool.removeFromPeerDetailsMap(ip, port);

        if (this.peerPool.getNumberOfconnectedPeers() < 40) {
          this.handleNewPeer();
        }
      };

      const handleAddBitfield = (bitfield) => {
        this.peerPool.addBitfieldToPeerMap(ip, port, bitfield);
      };

      const socketInstance = new Peer(
        ip,
        port,
        this.infoHash,
        this.globalPieces,
        removeConnectingPeersCallback,
        handleConnectionSuccess,
        handleAddBitfield,
        this.pieceLength,
        this.totalFileLength
      );

      this.peerPool.addToPeerDetailsMap(ip, port, socketInstance);
    }
  }
}
