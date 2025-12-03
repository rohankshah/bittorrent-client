export class Pieces {
  // PieceType: {
  //     status: 'NEEDED'|'COMPLETE',
  //     blocks: BlockType[]
  // }

  // BlockType: {
  //      status: 'NEEDED'|'REQUESTED'|'COMPLETE',
  //      offset: number,
  //      length: numbe
  // }

  constructor(totalPieces, pieceLength, totalFileLength) {
    // 16kb block size
    this.blockSize = 16 * 1024;
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

      const totalBlocks = Math.ceil(currPieceLength / this.blockSize);

      const blocks = [];
      let offset = 0;

      for (let j = 0; j < totalBlocks; j++) {
        const currBlockLength = Math.min(this.blockSize, currPieceLength - offset);

        blocks.push({
          state: 'NEEDED',
          offset: offset,
          length: currBlockLength
        });

        offset += currBlockLength;
      }

      this.allPieces[i] = {
        status: 'NEEDED',
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
}
