import net from 'net'
import { generateRandomString } from './lib/utils.js'

export class Peer_Protocol {
    constructor(host, port, infoHash) {
        this.host = host
        this.port = port
        this.infoHash = infoHash
        this.peerId = generateRandomString(20)

        this.socket = new net.Socket()
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

        this.socket.on('data', (data) => {
            console.log(`Data from ${this.host}:${this.port}:`, data)

            // Receiving handshake back
            if (data[0] === 19) {
                const len = data?.readUInt8(0)
                const messageId = data?.subarray(1, 20)?.toString('ascii')
                const reserved = data?.subarray(20, 28)?.readUint32BE()
                const infoHash = data?.subarray(28, 48)?.toString('hex')
                const peerId = data?.subarray(48, 68)?.toString()

                console.log('Start----------------')
                console.log(len, messageId, reserved)
                console.log(infoHash, this.infoHash, infoHash === this.infoHash)
                console.log(peerId, this.peerId, peerId === this.peerId)
                console.log('------------------END')
            }
        })

        this.socket.on('error', (err) => {
            // console.log(`Error connecting to ${ip}:${port}:`, err.message)
        })

        this.socket.on('close', () => {
            // console.log(`Connection closed: ${ip}:${port}`)
        })
    }

}