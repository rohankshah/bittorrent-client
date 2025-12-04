import { BLOCK_SIZE, Status } from '../constants/consts.js';

export class Pieces {
  // PieceType: {
  //     status: 'NEEDED'|'COMPLETE',
  //     blocks: BlockType[]
  // }

  // BlockType: {
  //      status: 'NEEDED'|'REQUESTED'|'COMPLETE',
  //      offset: number,
  //      length: number
  // }

  constructor(totalPieces, pieceLength, totalFileLength) {
    // 16kb block size
    this.totalFileLength = totalFileLength;
    this.pieceLength = pieceLength;
    this.totalPieces = totalPieces;

    // Mapping: PieceType[]
    this.allPieces = {};

    this.initializePieces();
  }

  initializePieces() {
    for (let i = 0; i < this.totalPieces; i++) {
      const currPieceLength = this.getPieceLength(i);

      const totalBlocks = Math.ceil(currPieceLength / BLOCK_SIZE);

      const blocks = [];
      let offset = 0;

      for (let j = 0; j < totalBlocks; j++) {
        const currBlockLength = Math.min(BLOCK_SIZE, currPieceLength - offset);

        blocks.push({
          state: Status.NEEDED,
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

  checkIfPieceNeeded(pieceIndex) {
    const piece = this.allPieces[pieceIndex];

    if (!piece) return false;

    if (piece.status === Status.NEEDED) {
      return true;
    }

    return false;
  }

  checkIfBlockNeeded(pieceIndex, block) {
    if (!this.checkIfPieceNeeded(pieceIndex)) return false

    const piece = this.allPieces[pieceIndex];

    const currBlock = piece.blocks.find((item) => item.offset === block.offset && item.length === block.length)

    if (!currBlock || currBlock.status === Status.COMPLETE || currBlock.status === Status.REQUESTED) return false

    return true
  }
}
