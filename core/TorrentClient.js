import { DOWNLOAD_FOLDER, SERVER_PORT } from '../constants/consts.js';
import { createFile, createFolder } from '../lib/files.js';
import { bufferToEncoding, getDNS, requestAnnounceWithTimeout } from '../lib/utils.js';
import { Peer } from './Peer.js';
import { PeerPool } from './PeerPool.js';
import { Pieces } from './Pieces.js';
import { Tracker } from './Tracker.js';

export class TorrentClient {
  constructor({ totalFileLength, infoHash, pieceLength, pieces, udpTrackers, files, name }) {
    this.infoHash = infoHash;
    this.totalFileLength = totalFileLength;
    this.pieceLength = pieceLength;
    this.pieces = pieces;
    this.udpTrackers = udpTrackers;
    this.files = files;
    this.name = name;

    this.peerPool = new PeerPool();

    this.globalPieces = new Pieces(
      this.peerPool,
      this.pieces.length,
      this.pieceLength,
      this.totalFileLength
    );
  }

  async start() {
    this.initializeFileStructure();
    await this.startTrackerAnnounce();
  }

  initializeFileStructure() {
    const parsedName = DOWNLOAD_FOLDER + bufferToEncoding(this.name, 'utf8');

    // // Create name folder
    createFolder(parsedName);

    // Create files/folders inside
    for (let i = 0; i < this.files.length; i++) {
      const fileObj = this.files[i];
      // const fileLength = fileObj.length;
      const path = [];
      fileObj['path'].forEach((item) => path.push(bufferToEncoding(item, 'utf8')));

      const folderPath =
        path?.length > 1 && [parsedName, ...path.slice(0, path.length - 1)]?.join('/');
      if (folderPath) {
        createFolder(folderPath);
      }

      const filePath = [parsedName, ...path].join('/');

      createFile(filePath, Buffer.alloc(0));
    }
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
        handleAddBitfield
      );

      this.peerPool.addToPeerDetailsMap(ip, port, socketInstance);
    }
  }
}
