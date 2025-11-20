import net from 'net'
import { generateRandomString } from './lib/utils.js'

export class Peer_Protocol {
    constructor(host, port, infoHash) {
        this.host = host
        this.port = port
        this.infoHash = infoHash
        this.peerId = generateRandomString(20)

        this.socket = new net.Socket()

        this.savedBuffer = Buffer.alloc(0)
        this.handShakeReceived = false


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

        this.socket.connect({ host: this.host, port: this.port }, () => {
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
                case 5:
                    this.handleBitfield(payload)
                    break
            }
        }
    }

    handleBitfield(payload) {
        // We read bitfield from right to left
        // The first byte of the bitfield corresponds to indices 0 - 7 from high bit to low bit, respectively. - from the spec
        for (let i = 0; i < payload.length; i++) {
            let byte = payload[i]
            for (let j = 0; j < 8; j++) {
                // If byte is 1
                if (byte % 2) {
                    const pieceIndice = i * 8 + (7 - j)
                    // console.log('pieceIndice', pieceIndice)
                }
                // Removes last bit from byte. So next iteration 2nd last bit is the last one
                byte = Math.floor(byte / 2)
            }
        }
    }
}