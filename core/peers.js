// Problem:
// Add new peers to pool
// Avoid duplicates being added
// Keep upto 40 connections alive. 
// Peers are rotated if a particular connection giving issues (choked or not uploading for 30-40 seconds)

export class Peers {
    constructor() {
        this.peerArr = []  // {ip: ip, port: port, lastTried: lastTried}[]

        this.currentPeerIndex = 0 // Mantan global index for current peer

        this.connectingPeers = [] // Peers where we have sent connection request

        this.connectedPeers = [] // Peers that sent handshake back
    }

    addPeer(peer) {
        this.peerArr.push(peer)
    }

    addConnectingPeer(peer) {
        this.connectingPeers.push(peer)
    }

    removePeer(peer) {
        const filteredConnecting = this.connectingPeers.filter((item) => item.ip !== peer.ip && item.port !== peer.port)
        this.connectingPeers = filteredConnecting

        const filteredConnected = this.connectedPeers.filter((item) => item.ip !== peer.ip && item.port !== peer.port)
        this.connectedPeers = filteredConnected
    }

    getNumberOfconnectingPeers() {
        return this.connectingPeers.length
    }

    addConnectedPeer(peer) {
        this.connectedPeers.push(peer)
    }

    getPeer() {
        // console.log(`trying ${this.currentPeerIndex} out of ${this.peerArr.length}. Current connected: ${this.connectedPeers.length}`)
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