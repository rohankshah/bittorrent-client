import { BLOCK_SIZE, MAX_PEER_REQUESTS, Status } from '../constants/consts.js';
import { PeerPool } from './PeerPool.js';
import crypto from 'crypto';

/**
 * @typedef {Object} Block
 * @property {'NEEDED' | 'COMPLETE' | 'REQUESTED'} status
 * @property {number} offset
 * @property {number} length
 */

/**
 * @typedef {Object} Piece
 * @property {'NEEDED' | 'COMPLETE'} status
 * @property {Block[]} blocks
 * @property {number} completed
 */

/**
 * @typedef {Object} File
 * @property {number} length
 * @property {string[]} path
 */

export class Pieces {
  /**
   *
   * @param {PeerPool} peerPool
   * @param {string[]} pieceHashes
   * @param {number} totalPieces
   * @param {number} pieceLength
   * @param {number} totalFileLength
   * @param {File} files
   */
  constructor(peerPool, pieceHashes, totalPieces, pieceLength, totalFileLength, files) {
    this.peerPool = peerPool;

    // 16kb block size
    this.totalFileLength = totalFileLength;
    this.pieceLength = pieceLength;
    this.pieceHashes = pieceHashes;
    this.totalPieces = totalPieces;
    this.files = files;

    /**
     * @type {Piece[]}
     */
    this.allPieces = {};

    this.pieceBuffers = [];

    this.initializePieceBuffers();
    this.initializePieces();
    this.runDownload();
  }

  initializePieces() {
    for (let i = 0; i < this.totalPieces; i++) {
      const currPieceLength = this.getPieceLength(i);

      const totalBlocks = Math.ceil(currPieceLength / BLOCK_SIZE);

      /**
       * @type {Block[]}
       */
      const blocks = [];
      let offset = 0;

      for (let j = 0; j < totalBlocks; j++) {
        const currBlockLength = Math.min(BLOCK_SIZE, currPieceLength - offset);

        blocks.push({
          status: Status.NEEDED,
          index: i,
          offset: offset,
          length: currBlockLength
        });

        offset += currBlockLength;
      }

      this.allPieces[i] = {
        status: Status.NEEDED,
        blocks: blocks,
        completed: 0
      };
    }
  }

  initializePieceBuffers() {
    this.pieceBuffers = Array.from({ length: this.totalPieces }).map((_, i) => {
      const currPieceLength = this.getPieceLength(i);
      return Buffer.alloc(currPieceLength);
    });
  }

  getPieceLength(pieceIndex) {
    if (pieceIndex < this.totalPieces - 1) {
      return this.pieceLength;
    }

    const lastPieceLength = this.totalFileLength % this.pieceLength;
    return lastPieceLength === 0 ? this.pieceLength : lastPieceLength;
  }

  runDownload() {
    // Find free peers
    const freePeers = this.findAvailablePeers();

    // Loop through free peers
    for (const [peerKey, peerObj] of freePeers) {
      // Find what piece is needed
      const piece = this.getPieceNeededForPeer(peerObj?.bitfield);

      if (piece === null) continue;

      // Get needed block for that piece
      const block = this.getBlockNeededForPiece(piece);

      if (block === null) continue;

      if (peerObj?.instance?.getRequestedQueueLength() < MAX_PEER_REQUESTS) {
        peerObj?.instance?.requestBlock(block);

        this.markBlockRequested(piece, block);
      }
    }

    const delay = freePeers.length === 0 ? 50 : 0;

    setTimeout(() => this.runDownload(), delay);
  }

  findAvailablePeers() {
    const freePeers = [];
    for (const [peerKey, peerObj] of this.peerPool.peerDetailsMap.entries()) {
      if (peerObj?.instance?.isPeerFree()) {
        freePeers.push([peerKey, peerObj]);
      }
    }

    return freePeers;
  }

  // Loop through bitfieldArr and see if a piece is required
  getPieceNeededForPeer(bitfieldArr) {
    for (let i = 0; i < bitfieldArr.length; i++) {
      const pieceIndex = bitfieldArr[i];

      const isPieceNeeded = this.checkIsPieceNeeded(pieceIndex);

      if (isPieceNeeded) {
        return pieceIndex;
      }
    }

    return null;
  }

  markBlockRequested(pieceIndex, block) {
    const piece = this.allPieces[pieceIndex];
    if (!piece) return;

    const foundBlock = piece.blocks.find(
      (item) => item.offset === block.offset && item.length === block.length
    );

    if (!foundBlock) return;

    foundBlock.status = Status.REQUESTED;
  }

  markBlockDownloaded(pieceIndex, blockOffset, data) {
    const piece = this.allPieces[pieceIndex];
    if (!piece) return;

    const foundBlock = piece.blocks.find((item) => item.offset === blockOffset);

    if (!foundBlock) return;

    const pieceBuffer = this.pieceBuffers[pieceIndex];

    data.copy(pieceBuffer, blockOffset);

    foundBlock.status = Status.COMPLETE;

    piece.completed += 1;

    console.log(piece.completed + '/' + piece.blocks.length)

    if (piece.completed === piece.blocks.length) {
      this.verifyPiece(pieceIndex);
    }
  }

  checkIsPieceNeeded(index) {
    const piece = this.allPieces[index];

    if (!piece) return false;

    return (piece.status = Status.NEEDED ? true : false);
  }

  getBlockNeededForPiece(pieceIndex) {
    const piece = this.allPieces[pieceIndex];

    if (!piece) return null;

    const blocks = piece.blocks;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block?.status === 'NEEDED') {
        return block;
      }
    }
    return null;
  }

  verifyPiece(pieceIndex) {
    const pieceBuffer = this.pieceBuffers[pieceIndex];

    const hash = crypto.createHash('sha1');
    hash.update(pieceBuffer);
    const calcPieceHash = hash.digest('hex');

    // Todo: Compare to torrent file SHA1 hash
    const actualPieceHash = this.pieceHashes[pieceIndex];
    const actualPieceHashHex = actualPieceHash.toString('hex');

    console.log('hashes', calcPieceHash, ' ', actualPieceHashHex);

    const isSame = actualPieceHashHex === calcPieceHash;
    const piece = this.allPieces[pieceIndex];

    if (isSame) {
      console.log('is same')
      piece.status = Status.COMPLETE;

      // Todo: Save to disk
    } else {
      console.log('is different')
      piece.blocks.forEach((block) => block.status === Status.NEEDED);

      const pieceLength = this.getPieceLength(pieceIndex);
      this.pieceBuffers[pieceIndex] = Buffer.alloc(pieceLength);
    }
  }
}
