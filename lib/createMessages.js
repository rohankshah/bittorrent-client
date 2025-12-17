export function createUdpConnectPacket(transactionId) {
  const buf = Buffer.alloc(16);

  buf.writeBigUInt64BE(0x41727101980n, 0);
  buf.writeUInt32BE(0, 8);
  buf.writeUInt32BE(transactionId, 12);

  return buf;
}

export function createUdpAnnounceRequest(
  infoHash,
  peerId,
  connectionId,
  transactionId,
  totalFileLength
) {
  const infoHashBuf = Buffer.from(infoHash, 'hex');
  const peerIdBuf = Buffer.from(peerId);

  const buf = Buffer.alloc(98);
  // Connection Id
  buf.writeBigUInt64BE(BigInt(connectionId), 0);
  // Action - Announce (1)
  buf.writeUInt32BE(1, 8);
  // Action - Announce (1)
  buf.writeUInt32BE(transactionId, 12);
  // Info hash
  infoHashBuf.copy(buf, 16);
  // Peer Id
  peerIdBuf.copy(buf, 36);
  // Downloaded
  buf.writeBigUInt64BE(BigInt(0), 56);
  // Left
  buf.writeBigUInt64BE(BigInt(totalFileLength), 64);
  // Uploaded
  buf.writeBigUInt64BE(BigInt(0), 72);
  // Event - None (0)
  buf.writeUInt32BE(0, 80);
  // IP address - (0)
  buf.writeUInt32BE(0, 84);
  // key - Optional not important atm
  buf.writeUInt32BE(79012, 88);
  // num_want - (-1) default
  buf.writeInt32BE(-1, 92);
  // port - 6881 rn
  buf.writeUInt16BE(6881, 96);

  return buf;
}

export function createHandshakeBuffer(infoHash, peerId) {
  const buf = Buffer.alloc(68);
  buf.writeUInt8(19, 0);
  buf.write('BitTorrent protocol', 1);
  buf.writeBigUInt64BE(0n, 20);

  const infoHashBuf = Buffer.from(infoHash, 'hex');
  infoHashBuf.copy(buf, 28);

  const peerIdBuf = Buffer.from(peerId);
  peerIdBuf.copy(buf, 48);

  return buf;
}

export function createInterestBuffer() {
  const buf = Buffer.alloc(5);

  // length of the message
  buf.writeUInt32BE(1, 0);
  // id of the message
  buf.writeUInt8(2, 4);

  return buf;
}

export function createRequestBlockBuffer(block) {
  const buf = Buffer.alloc(17);

  // Length of message
  buf.writeUInt32BE(13);
  // MessageId 6 for request
  buf.writeUint8(6, 4);
  // piece index
  buf.writeUInt32BE(block.index, 5);
  // block offset
  buf.writeUInt32BE(block.offset, 9);
  // block length?
  buf.writeUInt32BE(block.length, 13);

  return buf;
}

export function createAnnounceHaveBuffer(pieceIndex) {
  const buf = Buffer.alloc(9);

  buf.writeUint32BE(5, 0);

  buf.writeUint8(4, 4);

  buf.writeUint32BE(pieceIndex, 5);

  return buf;
}
export function createBitfieldMessage(bitfieldBuffer) {
  const messageLength = 1 + bitfieldBuffer.length;

  const buf = Buffer.alloc(4 + messageLength);

  buf.writeUInt32BE(messageLength, 0);

  buf.writeUInt8(5, 4);

  buf.set(bitfieldBuffer, 5);

  return buf;
}
