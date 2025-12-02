import net from 'net'
import { generateRandomString } from '../lib/utils.js'

export class Peer_Protocol {
    constructor(host, port, infoHash, globalPieces, disconnectCallback) {
        this.host = host
        this.port = port
        this.infoHash = infoHash
        this.peerId = generateRandomString(20)

        this.globalPieces = globalPieces

        this.disconnectCallback = disconnectCallback

        this.blocks = []

        this.savedBuffer = Buffer.alloc(0)
        this.handShakeReceived = false

        this.peerChoking = true
        this.amChoking = true
        this.peerInterested = false
        this.amInterested = false

        this.socket = new net.Socket()

        // Event listeners
        this.socket.on('data', (data) => this.listenData(data))

        this.socket.on('error', (err) => {
            // console.log(`Error connecting to ${ip}:${gggggg}:`, err.message)
        })

        this.socket.on('close', () => {
            // console.log(`Connection closed: ${ip}:${port}`)
        })
    }

    createHandshakeBuffer() {
        const buf = Buffer.alloc(68)
        buf.writeUInt8(19, 0)
        buf.write('BitTorrent protocol', 1)
        buf.writeBigUInt64BE(0n, 20)

        const infoHashBuf = Buffer.from(this.infoHash, 'hex');
        infoHashBuf.copy(buf, 28)

        const peerIdBuf = Buffer.from(this.peerId)
        peerIdBuf.copy(buf, 48)

        return buf
    }

    TCPHandshake() {
        const buf = this.createHandshakeBuffer()

        const timeoutId = setTimeout(() => {
            this.disconnect()
        }, 20000)

        this.socket.connect({ host: this.host, port: this.port }, () => {
            clearTimeout(timeoutId)
            console.log(`Connected to ${this.host}:${this.port}`)
            this.socket.write(buf)
        })
    }

    listenData(data) {
        // TCP doesn't return all data altogether. So need to first collect all of it
        this.savedBuffer = Buffer.concat([this.savedBuffer, data])

        while (this.savedBuffer.byteLength >= 4 && !this.handShakeReceived && this.savedBuffer.byteLength >= 68) {
            const tempData = this.savedBuffer?.subarray(0, 68)
            this.savedBuffer = this.savedBuffer.subarray(68)

            // const len = tempData?.readUInt8(0)
            // const messageId = tempData?.subarray(1, 20)?.toString('ascii')
            // const reserved = tempData?.subarray(20, 28)?.readUint32BE()
            const infoHash = tempData?.subarray(28, 48)?.toString('hex')
            // const peerId = tempData?.subarray(48, 68)?.toString()


            // Only proceed if...
            if (infoHash === this.infoHash) {
                console.log('received handshake')
                this.handShakeReceived = true
            }
        }

        while (this.savedBuffer.byteLength >= 4 && this.handShakeReceived && this.savedBuffer.byteLength >= this.savedBuffer?.readUInt32BE(0) + 4) {
            const tempData = this.savedBuffer?.subarray(0, 68)
            this.savedBuffer = this.savedBuffer.subarray(68)

            const length = tempData.readUInt32BE(0)
            const messageId = tempData.readUInt8(4)
            const payload = tempData.subarray(5)

            switch (parseInt(messageId)) {
                case 0:
                    console.log('choke')
                    this.peerChoking = true
                    break
                case 1:
                    console.log('unchoke')
                    this.handleUnchoke()
                    break
                case 2:
                    console.log('interested')
                    break
                case 3:
                    console.log('not interested')
                    break
                case 5:
                    this.handleBitfield(payload)
                    break
                case 7:
                    console.log('recieve piece')
                    break
            }
        }
    }

    handleUnchoke() {
        this.peerChoking = false

        if (this.blocks && this.blocks.length > 0) {
            const blockToRequest = this.blocks.pop()
            this.requestBlock(blockToRequest)
        }
    }

    handleBitfield(payload) {
        // We read bitfield from right to left
        // The first byte of the bitfield corresponds to indices 0 - 7 from high bit to low bit, respectively. - from the spec
        let allBlocks = []
        for (let i = 0; i < payload.length; i++) {
            let byte = payload[i]
            for (let j = 0; j < 8; j++) {
                // If byte is 1
                if (byte % 2) {
                    const pieceIndice = i * 8 + (7 - j)

                    if (this.globalPieces.isPieceInRequested(pieceIndice)) {
                        continue
                    }

                    const blocks = this.globalPieces.getBlocksForPiece(pieceIndice)
                    allBlocks = [...allBlocks, ...blocks]

                    // this.requestBlock(blocks[0])

                    // Cant send too many at once. Make queue to request instead of directly requesting
                    // blocks.forEach((block) => {
                    //     this.requestBlock(block)
                    // })
                }
                // Removes last bit from byte. So next iteration 2nd last bit is the last one
                byte = Math.floor(byte / 2)
            }
        }

        // console.log(allBlocks)
        if (!this.peerChoking && this.amInterested) {
            const blockToRequest = this.blocks.pop()
            this.requestBlock(blockToRequest)
        } else {
            this.sendInterest()
        }
    }

    requestBlock(block) {
        const buf = Buffer.alloc(17);

        // Length of message
        buf.writeUInt32BE(13)
        // MessageId 6 for request
        buf.writeUint8(6, 4)
        // piece index
        buf.writeUInt32BE(block.index, 5);
        // block begin
        buf.writeUInt32BE(block.begin, 9);
        // block length?
        buf.writeUInt32BE(block.length, 13);

        this.socket.write(buf)
        console.log('requested')
        this.globalPieces.addBlockToRequested(block)
    }

    sendInterest() {
        const buf = Buffer.alloc(17);

        // Length of message
        buf.writeUInt32BE(4)
        // MessageId 2 for interested
        buf.writeUint8(2, 4)

        this.socket.write(buf)
        this.amInterested = true
        console.log('send interest')
    }

    disconnect() {
        console.log(`disconnecting ${this.host}:${this.port}`)
        this.disconnectCallback()
    }
}