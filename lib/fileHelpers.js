import fs from 'node:fs';

export function createFolder(folderName) {
  try {
    if (!fs.existsSync(folderName)) {
      fs.mkdirSync(folderName, { recursive: true });
    }
  } catch (err) {
    console.error(err);
  }
}

export function createFile(folderPath, content) {
  fs.writeFile(folderPath, content, (err) => {
    if (err) {
      console.error(err);
    }
  });
}
