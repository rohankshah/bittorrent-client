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

export function saveBufferToFile(currFilePath, dataToWrite, writeOffsetInFile) {
  try {
    const res = fs.openSync(currFilePath, 'r+');
    fs.writeSync(res, dataToWrite, 0, dataToWrite.length, writeOffsetInFile);
    fs.closeSync(res);

    console.log('successfull write');
  } catch (err) {
    console.error(err);
  }
}