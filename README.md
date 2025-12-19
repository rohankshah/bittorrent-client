# BitTorrent Client (JavaScript)

This is a simple bittorrent client based on [spec](https://www.bittorrent.org/beps/bep_0003.html).

**Note:** This is an experimental implementation intended for learning and research. It is not intended for downloading copyrighted content. Use legally permitted torrents only.

## Project flow
- Parse '.torrent' metadata.
- Connect with trackers (only UDP currently) to get peers.
- Peer handshake and bitfield message parsing.
- Manage a global pieces state and requesting blocks from peers.
- Verify received pieces and save them to file


## Getting Started

### Install

```bash
git clone https://github.com/rohankshah/bittorrent-client
cd bittorrent-client
npm install
```

### Download file

Modify '.torrent' file path in 'index.js' to the file you wish to download
```bash
node index.js
```
