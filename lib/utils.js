import dns from 'dns';

export async function getDNS(trackerUrl) {
  const options = {
    family: 4,
    hints: dns.ADDRCONFIG | dns.V4MAPPED
  };
  return new Promise((resolve, reject) => {
    dns.lookup(trackerUrl, options, async (err, address) => {
      if (err) {
        // console.log('err', err)
        reject(err);
      }
      resolve(address);
    });
  });
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

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
