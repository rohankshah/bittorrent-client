import bencode from 'bencode'
import crypto from 'crypto'
import dns from 'dns'

export function generateInfoHash(infoObj) {
    const bencoded = bencode.encode(infoObj)
    const hash = crypto.createHash('sha1');
    hash.update(bencoded)
    const infoHash = hash.digest('hex')

    return infoHash
}

export function getPiecesArr(piecesObj) {
    const piecesString = bufferToEncoding(piecesObj, 'hex')
    const pieces = []
    let current = ''

    for (let i = 0; i < piecesString.length; i++) {
        current += piecesString[i]
        if (current.length === 20) {
            pieces.push(current)
            current = ''
        }
    }

    if (current && current.length > 0) {
        pieces.push(current)
    }

    return pieces
}

export async function getDNS(trackerUrl) {
    const options = {
        family: 4,
        hints: dns.ADDRCONFIG | dns.V4MAPPED,
    };
    return new Promise((resolve, reject) => {
        dns.lookup(trackerUrl, options, async (err, address) => {
            if (err) {
                // console.log('err', err)
                reject(err)
            }
            resolve(address)
        });
    })
}

export function bufferToEncoding(obj, encoding) {
    return Buffer.from(obj).toString(encoding)
}

export function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

export function getFirstRelevantTracker(res) {
    const announceTracker = res['announce']
    const announceTrackerList = res['announce-list']

    if (announceTracker) {
        const parsed = bufferToEncoding(announceTracker, 'utf8')

        if (parsed.startsWith('udp')) {
            return parsed
        }
    } else {
        for (let i = 0; i < announceTrackerList.length; i++) {
            const tracker = announceTrackerList[i]
            const parsed = bufferToEncoding(tracker[0], 'utf8')

            if (parsed.startsWith('udp')) {
                return parsed
            }
        }
    }

    return null
}


// Just UDP for now
export function getAllTrackers(res) {
    const trackerList = []

    const announceTracker = res['announce']
    const announceTrackerList = res['announce-list']

    if (announceTracker) {
        const parsed = bufferToEncoding(announceTracker, 'utf8')

        if (parsed.startsWith('udp')) {
            trackerList.push(parsed)
        }
    }
    for (let i = 0; i < announceTrackerList.length; i++) {
        const tracker = announceTrackerList[i]
        const parsed = bufferToEncoding(tracker[0], 'utf8')

        if (parsed.startsWith('udp')) {
            trackerList.push(parsed)
        }
    }

    return trackerList.length > 0? trackerList : null
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
