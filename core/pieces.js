export class Pieces {
    constructor(totalPieces, pieceLength, totalFileLength) {

        // 16kb block size
        this.blockSize = 16 * 1024
        this.totalFileLength = totalFileLength
        this.pieceLength = pieceLength
        this.totalPieces = totalPieces

        // Mapping: PieceIndex -> Block[]
        this.requested = {};
        this.downloaded = {};
    }

    isPieceInRequested(index) {
        if (!this.requested[index]) {
            return false
        }
        return true
    }

    addBlockToRequested(block) {
        const index = block.begin
        if (!this.requested[index]) {
            this.requested[index] = []
        }
        this.requested[index].push(block)
    }

    getBlocksForPiece(index) {
        const pieceStart = index * this.pieceLength

        let thisPieceLength = this.pieceLength
        if (pieceStart + this.pieceLength > this.totalFileLength) {
            thisPieceLength = this.totalFileLength - pieceStart
        }

        const blocks = []
        let offset = 0

        while (offset < thisPieceLength) {
            const length = Math.min(this.blockSize, thisPieceLength - offset)
            blocks.push({
                index: index,
                begin: offset,
                length: length
            })
            offset += this.blockSize
        }

        // if (!this.requested[index]) {
        //     this.requested[index] = blocks
        // }

        return blocks
    }
}