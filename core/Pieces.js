import { BLOCK_SIZE, MAX_PEER_REQUESTS, Status } from '../constants/consts.js';
import { PeerPool } from './PeerPool.js';

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
 */

export class Pieces {
  /**
   *
   * @param {PeerPool} peerPool
   * @param {number} totalPieces
   * @param {number} pieceLength
   * @param {number} totalFileLength
   */
  constructor(peerPool, totalPieces, pieceLength, totalFileLength) {
    this.peerPool = peerPool;

    // 16kb block size
    this.totalFileLength = totalFileLength;
    this.pieceLength = pieceLength;
    this.totalPieces = totalPieces;

    /**
     * @type {Piece[]}
     */
    this.allPieces = {};

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
          offset: offset,
          length: currBlockLength
        });

        offset += currBlockLength;
      }

      this.allPieces[i] = {
        status: Status.NEEDED,
        blocks: blocks
      };
    }
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

      if (typeof piece === null) continue;

      // Get needed block for that piece
      const block = this.getBlockNeededForPiece(piece);

      if (typeof block === null) continue;

      if (peerObj?.instance?.getRequestedQueueLength() < MAX_PEER_REQUESTS) {
        peerObj?.instance?.requestBlock(block);

        this.markBlockRequested(piece, block);
      }

      // peerObj?.instance?

      // Add to peer request queue

      // console.log(peerKey, ' is free');
    }

    setImmediate(() => this.runDownload());
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

    console.log('foundBlock', foundBlock)

    if (!foundBlock) return;

    foundBlock.status = Status.REQUESTED;
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
}
