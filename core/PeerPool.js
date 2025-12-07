// Problem:
// Add new peers to pool
// Avoid duplicates being added
// Keep upto 40 connections alive.
// Peers are rotated if a particular connection giving issues (choked or not uploading for 30-40 seconds)

import { constructPeerKey } from '../lib/utils.js';
import { Peer } from './Peer.js';

/**
 * @typedef {Object} PeerEntry
 * @property {Peer} instance
 * @property {number[] | null} bitfield
 */

export class PeerPool {
  constructor() {
    this.peerArr = []; // {ip: ip, port: port, lastTried: lastTried}[]

    this.currentPeerIndex = 0; // Mantan global index for current peer

    this.connectedPeers = []; // Peers that sent handshake back

    /**
     * @type {Map<string, PeerEntry>}
     */
    this.peerDetailsMap = new Map();
  }

  addPeer(peer) {
    this.peerArr.push(peer);
  }

  removePeer(peer) {
    const filteredConnected = this.connectedPeers.filter(
      (item) => item.ip !== peer.ip && item.port !== peer.port
    );
    this.connectedPeers = filteredConnected;
  }

  getNumberOfconnectedPeers() {
    return this.connectedPeers.length;
  }

  addConnectedPeer(peer) {
    this.connectedPeers.push(peer);
  }

  getPeer() {
    // Todo: Verify logic again, write test
    const peer = this.peerArr[this.currentPeerIndex];
    this.currentPeerIndex += 1;

    if (this.currentPeerIndex >= this.peerArr.length) {
      this.currentPeerIndex = 0;
    }
    return peer;
  }

  addToPeerDetailsMap(host, port, socketInstance) {
    const peerKey = constructPeerKey(host, port);
    const peerDetailsObj = {
      instance: socketInstance,
      bitfield: null
    };
    this.peerDetailsMap.set(peerKey, peerDetailsObj);
  }

  removeFromPeerDetailsMap(host, port) {
    const peerKey = constructPeerKey(host, port);
    this.peerDetailsMap.delete(peerKey);
  }

  addBitfieldToPeerMap(host, port, bitfield) {
    const peerKey = constructPeerKey(host, port);
    if (!this.peerDetailsMap.has(peerKey)) {
      return;
    }

    const existingObj = this.peerDetailsMap.get(peerKey);

    existingObj.bitfield = bitfield;

    this.peerDetailsMap.set(peerKey, existingObj);
  }
}
