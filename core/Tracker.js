import dgram from 'node:dgram';
import { generateRandomString } from '../lib/utils.js';
import { createUdpAnnounceRequest, createUdpConnectPacket } from '../lib/createMessages.js';

export class Tracker {
  /**
   *
   * @param {string} serverAddress
   * @param {string} serverPort
   * @param {string} infoHash
   * @param {number} totalFileLength
   */
  constructor(serverAddress, serverPort, infoHash, totalFileLength) {
    this.serverAddress = serverAddress;
    this.serverPort = serverPort;
    this.infoHash = infoHash;
    this.peerId = generateRandomString(20);
    this.totalFileLength = totalFileLength;

    this.transactionId = Math.floor(Math.random() * 0xffffffff);
    this.connectionId = 0;

    this.server = null;

    this.initializeUdpServer();
  }

  initializeUdpServer() {
    this.server = dgram.createSocket('udp4');
    this.server.on('message', this.recieveMessageCallback);
  }

  resetTransactionId() {
    this.transactionId = Math.floor(Math.random() * 0xffffffff);
  }

  sendPacket(buf) {
    this.server.send(buf, 0, buf.length, this.serverPort, this.serverAddress, (err) => {
      if (err) {
        console.log('Send error:', err);
      }
    });
  }

  recieveMessageCallback = (res, rinfo) => {
    // console.log('res', res, rinfo)

    // Announce response
    if (res.byteLength >= 20) {
      const action = res?.readUInt32BE(0, 5);
      const responseTransactionId = res?.readUInt32BE(4, 9);
      const interval = res?.readUInt32BE(8, 13);
      const leechers = res?.readUInt32BE(12, 17);
      const seeders = res?.readUInt32BE(16, 21);

      const peers = [];
      let i = 20;
      while (i < res.byteLength) {
        const peer = res?.slice(i, i + 6);
        const ip = [peer[0], peer[1], peer[2], peer[3]].join('.');
        const port = peer?.readUInt16BE(4);
        const peerObj = { ip, port };
        peers.push(peerObj);
        i = i + 6;
      }

      const trackerAnnounceResponse = {
        action,
        responseTransactionId,
        interval,
        leechers,
        seeders,
        peers
      };

      if (this.onAnnounce) {
        this.onAnnounce(trackerAnnounceResponse);
      }
    }

    // Connect response
    if (res.byteLength >= 16) {
      const action = res.subarray(0, 5)?.readUInt32BE();
      const transactionId = res.subarray(4, 9)?.readUInt32BE();
      const connectionId = res.subarray(8, 17)?.readBigUInt64BE();

      if (action === 0 && transactionId === this.transactionId) {
        this.connectionId = connectionId;
        this.announceRequest();
      }
    }
  };

  connectRequest() {
    // Create connect packet
    const buf = createUdpConnectPacket(this.transactionId);
    this.sendPacket(buf);
  }

  announceRequest() {
    this.resetTransactionId();

    const buf = createUdpAnnounceRequest(
      this.infoHash,
      this.peerId,
      this.connectionId,
      this.transactionId,
      this.totalFileLength
    );

    this.sendPacket(buf);
  }
}
