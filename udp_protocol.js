import dgram from 'node:dgram'

export class UDP_Protocol {
    constructor(serverAddress, serverPort) {
        this.serverAddress = serverAddress
        this.serverPort = serverPort

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
            if (err) console.error('Send error:', err);
            else console.log('Connect request sent');
        });
    }

    recieveMessageCallback = (res, rinfo) => {
        console.log('res', res?.byteLength, rinfo)

        const action = res.subarray(0, 5)?.readUInt32BE()
        const transactionId = res.subarray(4, 9)?.readUInt32BE()
        const connectionId = res.subarray(8, 17)?.readBigUInt64BE()

        if (transactionId === this.transactionId && action === 0) {
            this.connectionId = connectionId
        }
    }

    connectMessage() {
        // Create connect packet
        const buf = Buffer.alloc(16)

        buf.writeBigUInt64BE(0x41727101980n, 0)
        buf.writeUInt32BE(0, 8)
        buf.writeUInt32BE(this.transactionId, 12);

        this.sendPacket(buf)
    }

}