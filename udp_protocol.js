import dgram from 'node:dgram'
import { generateRandomString } from './lib/utils.js'

export class UDP_Protocol {
    constructor(serverAddress, serverPort, infoHash, totalFileLength) {
        this.serverAddress = serverAddress
        this.serverPort = serverPort
        this.infoHash = infoHash
        this.peerId = generateRandomString(20)
        this.totalFileLength = totalFileLength

        this.server = dgram.createSocket('udp4');

        this.transactionId = Math.floor(Math.random() * 0xffffffff);
        this.connectionId = 0

        this.server.on('message', this.recieveMessageCallback);
    }

    resetTransactionId() {
        this.transactionId = Math.floor(Math.random() * 0xffffffff);
    }

    sendPacket(buf) {
        this.server.send(buf, 0, buf.length, this.serverPort, this.serverAddress, (err) => {
            if (err) {
                console.log('Send error:', err)
            }
            else {
                console.log('Request sent');
            }
        });
    }

    recieveMessageCallback = (res, rinfo) => {
        console.log('res', res, rinfo)

        if (res.byteLength >= 20) {
            console.log('announce response returned')
        }

        if (res.byteLength >= 16) {
            const action = res.subarray(0, 5)?.readUInt32BE()
            const transactionId = res.subarray(4, 9)?.readUInt32BE()
            const connectionId = res.subarray(8, 17)?.readBigUInt64BE()

            if (action === 0 && transactionId === this.transactionId) {
                console.log('is connect Response')
                this.connectionId = connectionId
                this.announceRequest()
            }
        }
    }

    connectRequest() {
        // Create connect packet
        const buf = Buffer.alloc(16)

        buf.writeBigUInt64BE(0x41727101980n, 0)
        buf.writeUInt32BE(0, 8)
        buf.writeUInt32BE(this.transactionId, 12);

        this.sendPacket(buf)
    }

    announceRequest() {
        this.resetTransactionId()

        const buf = Buffer.alloc(98)
        // Connection Id
        buf.writeBigUInt64BE(BigInt(this.connectionId), 0)
        // Action - Announce (1)
        buf.writeUInt32BE(1, 8)
        // Info hash
        buf.write(this.infoHash, 16)
        // Peer Id
        buf.write(this.peerId, 36)
        // Downloaded
        buf.writeBigUInt64BE(BigInt(0), 56)
        // Left
        buf.writeBigUInt64BE(BigInt(this.totalFileLength), 64)
        // Uploaded
        buf.writeBigUInt64BE(BigInt(0), 72)
        // Event - None (0)
        buf.writeUInt32BE(0, 80)
        // IP address - (0)
        buf.writeUInt32BE(0, 84)
        // key - Optional not important atm
        buf.writeUInt32BE(79012, 88)
        // num_want - (-1) default
        buf.writeUInt32BE(50, 92)
        // port - 6881 rn
        buf.writeUInt16BE(6881, 96)

        this.sendPacket(buf)
    }

}