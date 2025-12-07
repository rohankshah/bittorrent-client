import net from 'net';
import { generateRandomString, getPiecesFromBitfield } from '../lib/utils.js';
import {
  createHandshakeBuffer,
  createInterestBuffer,
  createRequestBlockBuffer
} from '../lib/createMessages.js';
import { Pieces } from './Pieces.js';

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
   * @param {number} pieceLength
   * @param {number} totalFileLength
   */
  constructor(
    host,
    port,
    infoHash,
    globalPieces,
    disconnectCallback,
    connectSuccessCallback,
    handleAddBitfieldCallback,
    pieceLength,
    totalFileLength
  ) {
    this.host = host;
    this.port = port;
    this.infoHash = infoHash;
    this.peerId = generateRandomString(20);

    this.globalPieces = globalPieces;

    this.disconnectCallback = disconnectCallback;
    this.connectSuccessCallback = connectSuccessCallback;
    this.handleAddBitfield = handleAddBitfieldCallback;

    this.pieceLength = pieceLength;
    this.totalFileLength = totalFileLength;

    this.currentPiece = null;

    // Arr which stores pieceIndices for the pieces this peer has
    this.peerPieces = [];
    this.bitfieldReceived = false;

    // This is where we store the original bitfield blocks
    this.blocks = [];
    // This is where we store the requested blocks
    this.requestedBlocks = [];
    // This is where we store the blocks that are complete
    this.downloadedBlocks = [];

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
      } else {
        this.disconnect();
      }
    }

    while (this.savedBuffer.byteLength >= 4 && this.handShakeReceived) {
      const totalMessageLength = this.savedBuffer.readUInt32BE(0) + 4;

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
          console.log('choke');
          this.peerChoking = true;
          break;
        case 1:
          console.log('unchoke');
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
        case 7:
          this.handleReceivePiece(payload);
          break;
      }
    }
  }

  handleBitfield(payload) {
    let allPieces = getPiecesFromBitfield(payload);

    this.peerPieces = allPieces;

    this.handleAddBitfield(allPieces);

    this.bitfieldReceived = true;

    this.sendInterest();
  }

  handleReceivePiece(payload) {
    console.log('received block', payload);

    const completedBlock = this.requestedBlocks.pop();
    this.downloadedBlocks.push(completedBlock);
  }

  requestBlock(block) {
    const buf = createRequestBlockBuffer(block);

    this.socket.write(buf);
    console.log('requested');
  }

  sendInterest() {
    const buf = createInterestBuffer();

    this.socket.write(buf);
    this.amInterested = true;
    console.log('send interest');
  }

  isPeerFree() {
    if (this.peerChoking || !this.bitfieldReceived) {
      return false;
    }
    return true;
  }

  disconnect() {
    // console.log(`disconnecting ${this.host}:${this.port}`)
    this.disconnectCallback();
  }
}
