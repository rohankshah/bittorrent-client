import net from 'net';
import { generateRandomString } from '../lib/utils.js';
import {
  createAnnounceHaveBuffer,
  createBitfieldMessage,
  createHandshakeBuffer,
  createInterestBuffer,
  createRequestBlockBuffer
} from '../lib/createMessages.js';
import { Pieces } from './Pieces.js';
import { getPiecesFromBitfield } from '../lib/torrentHelpers.js';
import { MAX_PEER_REQUESTS } from '../constants/consts.js';

export class Peer {
  /**
   *
   * @param {string} host
   * @param {string} port
   * @param {string} infoHash
   * @param {Pieces} globalPieces
   * @param {() => void} disconnectCallback
   * @param {() => void} connectSuccessCallback
   * @param {(number[]) => void} handleAddBitfieldCallback
   */
  constructor(
    host,
    port,
    infoHash,
    globalPieces,
    disconnectCallback,
    connectSuccessCallback,
    handleAddBitfieldCallback
  ) {
    this.host = host;
    this.port = port;
    this.infoHash = infoHash;
    this.peerId = generateRandomString(20);

    this.globalPieces = globalPieces;

    this.disconnectCallback = disconnectCallback;
    this.connectSuccessCallback = connectSuccessCallback;
    this.handleAddBitfield = handleAddBitfieldCallback;

    this.bitfieldReceived = false;

    this.requestedQueue = [];

    this.savedBuffer = Buffer.alloc(0);
    this.handShakeReceived = false;

    this.peerChoking = true;
    this.amChoking = true;
    this.peerInterested = false;
    this.amInterested = false;

    this.socket = null;

    this.initializeSocket();
    this.peerHandshake();
  }

  initializeSocket() {
    this.socket = new net.Socket();

    // Event listeners
    this.socket.on('data', (data) => this.listenData(data));
    this.socket.on('error', (err) => {
      // console.log(`Error connecting to ${ip}:${gggggg}:`, err.message)
    });
    this.socket.on('close', () => {
      // console.log(`Connection closed: ${ip}:${port}`)
      this.disconnect();
    });
  }

  peerHandshake() {
    const buf = createHandshakeBuffer(this.infoHash, this.peerId);
    this.socket.connect({ host: this.host, port: this.port }, () => {
      // console.log(`Connected to ${this.host}:${this.port}`);
      this.socket.write(buf);
    });
  }

  listenData(data) {
    // TCP doesn't return all data altogether. So need to first collect all of it
    this.savedBuffer = Buffer.concat([this.savedBuffer, data]);

    if (
      this.savedBuffer.byteLength >= 4 &&
      !this.handShakeReceived &&
      this.savedBuffer.byteLength >= 68
    ) {
      const tempData = this.savedBuffer?.subarray(0, 68);
      this.savedBuffer = this.savedBuffer.subarray(68);

      const infoHash = tempData?.subarray(28, 48)?.toString('hex');

      // Only proceed if...
      if (infoHash === this.infoHash) {
        // console.log('received handshake');
        this.handShakeReceived = true;
        this.connectSuccessCallback();

        // Send bitfield after handshake
        this.sendBitfield();
      } else {
        this.disconnect();
      }
    }

    while (this.savedBuffer.byteLength >= 4 && this.handShakeReceived) {
      // const totalMessageLength = this.savedBuffer.readUInt32BE(0) + 4;

      const length = this.savedBuffer.readUInt32BE(0);

      // Keep-alive message
      if (length === 0) {
        this.savedBuffer = this.savedBuffer.subarray(4);
        continue;
      }

      const totalMessageLength = length + 4;

      // Wait for more data
      if (this.savedBuffer.byteLength < totalMessageLength) {
        break;
      }

      const tempData = this.savedBuffer?.subarray(0, totalMessageLength);
      this.savedBuffer = this.savedBuffer.subarray(totalMessageLength);

      const messageId = tempData.readUInt8(4);
      const payload = tempData.subarray(5);

      // console.log('messageId', messageId);

      switch (parseInt(messageId)) {
        case 0:
          // console.log('choke');
          this.peerChoking = true;
          break;
        case 1:
          // console.log('unchoke');
          this.peerChoking = false;
          break;
        case 2:
          console.log('interested');
          break;
        case 3:
          console.log('not interested');
          break;
        case 4:
          // Won't implement this right now
          // A malicious peer might also choose to advertise having pieces that it knows the peer will never download.
          // Due to this attempting to model peers using this information is a bad idea.
          // ---- According to bit wiki spec
          break;
        case 5:
          this.handleBitfield(payload);
          break;
        case 6:
          console.log('peer has requested block');
          this.handleRequestFromPeer(payload);
          break;
        case 7:
          this.handleReceivePiece(payload);
          break;
      }
    }
  }

  handleBitfield(payload) {
    let allPieces = getPiecesFromBitfield(payload);

    this.handleAddBitfield(allPieces);

    this.bitfieldReceived = true;

    this.sendInterest();
  }

  handleRequestFromPeer(payload) {
    const pieceIndex = payload.readUInt32BE(0);
    const offset = payload.readUInt32BE(4);
    const length = payload.readUInt32BE(8);

    console.log('request block', pieceIndex, offset, length);
  }

  handleReceivePiece(payload) {
    const pieceIndex = payload.readUInt32BE();
    const blockOffset = payload.readUInt32BE(4);
    const data = payload.subarray(8);

    this.requestedQueue = this.requestedQueue.filter(
      (block) => !(block.index === pieceIndex && block.offset === blockOffset)
    );
    this.globalPieces.markBlockDownloaded(pieceIndex, blockOffset, data);
  }

  requestBlock(block) {
    const buf = createRequestBlockBuffer(block);

    this.socket.write(buf);

    this.requestedQueue.push({ ...block, requested: Date.now() });
  }

  announceHavePiece(pieceIndex) {
    const buf = createAnnounceHaveBuffer(pieceIndex);

    this.socket.write(buf);
  }

  getRequestedQueueLength() {
    return this.requestedQueue.length;
  }

  sendInterest() {
    const buf = createInterestBuffer();

    this.socket.write(buf);
    this.amInterested = true;
    // console.log('send interest');
  }

  sendBitfield() {
    const bitfieldBuffer = this.globalPieces.createBitfield();

    const buf = createBitfieldMessage(bitfieldBuffer);

    this.socket.write(buf);
  }

  isPeerFree() {
    if (
      this.peerChoking ||
      !this.bitfieldReceived ||
      this.getRequestedQueueLength() >= MAX_PEER_REQUESTS
    ) {
      return false;
    }
    return true;
  }

  disconnect() {
    this.disconnectCallback();
  }
}
