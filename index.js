import fs from 'node:fs';
import { readTorrentData } from './lib/torrentHelpers.js';
import { TorrentClient } from './core/TorrentClient.js';

try {
  const data = fs.readFileSync('./test4.torrent');

  const torrent = readTorrentData(data);

  const client = new TorrentClient(torrent);
  client.start();

  setInterval(() => {}, 1000);
} catch (err) {
  console.error(err);
}
