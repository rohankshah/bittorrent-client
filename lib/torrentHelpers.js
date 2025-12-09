import bencode from 'bencode';
import crypto from 'crypto';
import { shuffle } from './utils.js';

export function readTorrentData(data) {
  const res = bencode.decode(data);

  const totalFileLength = res['info']['files']?.reduce((total, curr) => total + curr?.length, 0);

  // Calculate infohash
  const infoHash = generateInfoHash(res['info']);

  // Extract pieces SHA1 array
  const piecesObj = res['info']['pieces'];
  const pieceLength = res['info']['piece length'];
  const pieces = getPiecesArr(piecesObj);

  const trackerArr = getAllTrackers(res);

  const udpTrackers = shuffle(trackerArr.filter((url) => url.startsWith('udp://')));

  const files = res['info']['files'];
  const parsedFiles = [];

  files.forEach((file) => {
    const parsedFile = {
      length: file.length,
      path: []
    };

    file.path.forEach((item) => parsedFile.path.push(bufferToEncoding(item, 'utf8')));

    parsedFiles.push(parsedFile);
  });

  const name = res['info']['name'];

  return { totalFileLength, infoHash, pieceLength, pieces, udpTrackers, parsedFiles, name };
}

export function generateInfoHash(infoObj) {
  const bencoded = bencode.encode(infoObj);
  const hash = crypto.createHash('sha1');
  hash.update(bencoded);
  const infoHash = hash.digest('hex');

  return infoHash;
}

export function getPiecesArr(piecesObj) {
  const piecesString = bufferToEncoding(piecesObj, 'hex');
  const pieces = [];
  let current = '';

  for (let i = 0; i < piecesString.length; i++) {
    current += piecesString[i];
    if (current.length === 20) {
      pieces.push(current);
      current = '';
    }
  }

  if (current && current.length > 0) {
    pieces.push(current);
  }

  return pieces;
}

export function bufferToEncoding(obj, encoding) {
  return Buffer.from(obj).toString(encoding);
}

// Just UDP for now
export function getAllTrackers(res) {
  const trackerList = [];

  const announceTracker = res['announce'];
  const announceTrackerList = res['announce-list'];

  if (announceTracker) {
    const parsed = bufferToEncoding(announceTracker, 'utf8');

    if (parsed.startsWith('udp')) {
      trackerList.push(parsed);
    }
  }
  for (let i = 0; i < announceTrackerList.length; i++) {
    const tracker = announceTrackerList[i];
    const parsed = bufferToEncoding(tracker[0], 'utf8');

    if (parsed.startsWith('udp')) {
      trackerList.push(parsed);
    }
  }

  return trackerList.length > 0 ? trackerList : null;
}

export function requestAnnounceWithTimeout(udpServer, timeout = 5000) {
  return new Promise((resolve, reject) => {
    let finished = false;

    udpServer.onAnnounce = (res) => {
      if (finished) return;
      finished = true;
      resolve(res);
    };

    setTimeout(() => {
      if (finished) return;
      finished = true;
      reject();
    }, timeout);

    udpServer.connectRequest();
  });
}

export function getBlocksForPiece(index, pieceLength, totalFileLength, blockSize = 16 * 1024) {
  const pieceStart = index * pieceLength;
  let thisPieceLength = pieceLength;

  if (pieceStart + pieceLength > totalFileLength) {
    thisPieceLength = totalFileLength - pieceStart;
  }

  const blocks = [];
  let offset = 0;

  while (offset < thisPieceLength) {
    const length = Math.min(blockSize, thisPieceLength - offset);

    blocks.push({
      index: index,
      offset: offset,
      length: length
    });

    offset += blockSize;
  }

  return blocks;
}

export function constructPeerKey(host, port) {
  return `${host}:${port}`;
}

export function getPiecesFromBitfield(bitfield) {
  let allPieces = [];
  // We read bitfield from right to left
  // The first byte of the bitfield corresponds to indices 0 - 7 from high bit to low bit, respectively. - from the spec
  for (let i = 0; i < bitfield.length; i++) {
    const byte = bitfield[i];
    for (let j = 0; j < 8; j++) {
      // Calculate the mask for the current bit.
      const mask = 1 << (7 - j);

      if ((byte & mask) !== 0) {
        const pieceIndice = i * 8 + j;

        allPieces.push(pieceIndice);
      }
    }
  }

  return allPieces;
}
