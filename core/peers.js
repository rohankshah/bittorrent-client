// Problem:
// Add new peers to pool
// Avoid duplicates being added
// Keep upto 40 connections alive. 
// Peers are rotated if a particular connection giving issues (choked or not uploading for 30-40 seconds)

export class Peers {
    constructor() {
        this.peerArr = []  // {ip: ip, port: port, lastTried: lastTried}[]

        this.currentPeerIndex = 0 // Mantan global index for current peer

        this.activePeers = []
    }

    addPeer(peer) {
        this.peerArr.push(peer)
    }

    addActivePeer(peer) {
        this.activePeers.push(peer)
    }

    removeActivePeer(peer) {
        const filtered = this.activePeers.filter((item) => item.ip !== peer.ip && item.port !== peer.port)
        this.activePeers = filtered
    }

    getNumberOfActivePeers() {
        return this.activePeers.length
    }

    getPeer() {
        console.log(`trying ${this.currentPeerIndex} out of ${this.peerArr.length}. Current connected: ${this.activePeers.length}`)
        const peer = this.peerArr[this.currentPeerIndex]
        this.currentPeerIndex += 1

        if (this.currentPeerIndex >= this.peerArr.length) {
            this.currentPeerIndex = 0
        }
        return peer
    }

    getPeerLength() {
        return this.peerArr.length
    }

    // Check if new peer available
    isNewPeerAvailable() {
        if (this.peerArr.length > this.currentPeerIndex) {
            return true
        }
        return false
    }
}