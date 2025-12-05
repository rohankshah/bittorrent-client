import net from 'net';
import { generateRandomString, getBlocksForPiece } from '../lib/utils.js';
import { PEER_BLOCK_TIMEOUT } from '../constants/consts.js';
import { createHandshakeBuffer } from '../lib/createMessages.js';

export class Peer_Protocol {
  constructor(
    host,
    port,
    infoHash,
    globalPieces,
    disconnectCallback,
    connectSuccessCallback,
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

    this.pieceLength = pieceLength;
    this.totalFileLength = totalFileLength;

    this.currentPiece = null;

    // Arr which stores pieceIndices for the pieces this peer has
    this.peerPieces = [];

    // This is where we store the original bitfield blocks
    this.blocks = [];
    // This is where we store the requested blocks
    this.requestedBlocks = [];
    // This is where we store the blocks that are complete
    this.downloadedBlocks = [];

    this.currentRequestTimeout = null;

    this.savedBuffer = Buffer.alloc(0);
    this.handShakeReceived = false;

    this.peerChoking = true;
    this.amChoking = true;
    this.peerInterested = false;
    this.amInterested = false;

    this.socket = null

    this.initializeSocket()
    this.peerHandshake()
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
      this.disconnect()
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
          this.handleUnchoke();
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

  handleUnchoke() {
    this.peerChoking = false;
    // this.handleRequestBlock();
  }

  handleBitfield(payload) {
    // We read bitfield from right to left
    // The first byte of the bitfield corresponds to indices 0 - 7 from high bit to low bit, respectively. - from the spec
    let allBlocks = [];
    let allPieces = [];
    for (let i = 0; i < payload.length; i++) {
      const byte = payload[i];
      for (let j = 0; j < 8; j++) {
        // Calculate the mask for the current bit.
        const mask = 1 << (7 - j);

        if ((byte & mask) !== 0) {
          const pieceIndice = i * 8 + j;

          allPieces.push(pieceIndice);

          // const blocks = getBlocksForPiece(pieceIndice, this.pieceLength, this.totalFileLength);

          // allBlocks = [...allBlocks, ...blocks];
        }
      }
    }

    this.peerPieces = allPieces;

    if (!this.peerChoking && this.amInterested) {
      this.handleRequestBlock();
    } else {
      this.sendInterest();
    }
  }

  handleReceivePiece(payload) {
    console.log('received block', payload);

    // Clear currentRequestTimeout
    this.currentRequestTimeout = null;

    const completedBlock = this.requestedBlocks.pop();
    this.downloadedBlocks.push(completedBlock);
    this.handleRequestBlock();
  }

  // Get piece:
  // We check bitfield piece to see if it's needed
  // If not we move on to next piece.
  // If no pieces are needed and/or all pieces in the array are over, we just return undefined and end function
  getNeededPiece() {
    if (this.peerPieces.length === 0) return null;

    let pieceNeeded = this.peerPieces.pop();

    while (pieceNeeded !== undefined && !this.globalPieces.checkIfPieceNeeded(pieceNeeded)) {
      pieceNeeded = this.peerPieces.pop();
    }

    return pieceNeeded === undefined ? null : pieceNeeded;
  }

  // Get block that's needed
  // We check block to see if needed.
  // If not we move to next block
  // If all blocks are done, we return and move back to next piece
  getNeededBlockForPiece() {
    if (!this.blocks || this.blocks.length === 0) return null;

    let block = this.blocks.pop();

    while (block !== undefined && !this.globalPieces.checkIfBlockNeeded(this.currentPiece, block)) {
      block = this.blocks.pop();
    }

    return block === undefined ? null : block;
  }

  handleRequestBlock() {
    // If some block is already requested, then return
    if (this.currentRequestTimeout) return;

    if (!this.blocks || this.blocks.length === 0) {
      const piece = this.getNeededPiece();
      if (piece === null) return null;

      this.currentPiece = piece;
      this.blocks = getBlocksForPiece(piece, this.pieceLength, this.totalFileLength);
    }

    let block = this.getNeededBlockForPiece();

    while (block === null) {
      const piece = this.getNeededPiece();
      if (piece === null) return null;

      this.currentPiece = piece;
      this.blocks = getBlocksForPiece(piece, this.pieceLength, this.totalFileLength);

      block = this.getNeededBlockForPiece();
    }

    console.log('blockrequest', block);

    this.requestedBlocks.push(block);
    this.requestBlock(block);

    // If data not received in 20 seconds then timeout
    this.currentRequestTimeout = setTimeout(() => {
      const timeoutBlock = this.requestedBlocks.pop();
      this.blocks.unshift(timeoutBlock);
      this.currentRequestTimeout = null;
      this.handleRequestBlock();
    }, PEER_BLOCK_TIMEOUT);
  }

  requestBlock(block) {
    const buf = Buffer.alloc(17);

    // Length of message
    buf.writeUInt32BE(13);
    // MessageId 6 for request
    buf.writeUint8(6, 4);
    // piece index
    buf.writeUInt32BE(block.index, 5);
    // block begin
    buf.writeUInt32BE(block.begin, 9);
    // block length?
    buf.writeUInt32BE(block.length, 13);

    this.socket.write(buf);
    console.log('requested');
  }

  sendInterest() {
    const buf = Buffer.alloc(5);

    // length of the message
    buf.writeUInt32BE(1, 0);
    // id of the message
    buf.writeUInt8(2, 4);

    this.socket.write(buf);
    this.amInterested = true;
    console.log('send interest');
  }

  disconnect() {
    // console.log(`disconnecting ${this.host}:${this.port}`)
    this.disconnectCallback();
  }
}
