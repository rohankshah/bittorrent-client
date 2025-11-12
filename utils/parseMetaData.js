function parseMetadata(data, i = 0) {
    let res = []

    while (i < data.length) {
        let current = data.toString('ascii', i, i + 1)

        if (current === 'e') {
            return { value: res, index: i + 1 }
        }

        if (current === 'd') {
            let obj = {}
            i += 1
            while (data.toString('ascii', i, i + 1) !== 'e') {
                const { value: key, index: keyIndex } = parseMetadata(data, i)
                i = keyIndex

                const { value: val, index: valIndex } = parseMetadata(data, i)
                i = valIndex

                if (key === 'pieces') {
                    obj[key] = '<hex>' + Buffer.from(val, 'binary').toString('hex') + '</hex>'
                } else {
                    obj[key] = val
                }
            }
            i += 1
            return { value: obj, index: i }
        }

        if (current === 'l') {
            let res = []
            i += 1
            while (data.toString('ascii', i, i + 1) !== 'e') {
                const { value: output, index } = parseMetadata(data, i)
                res.push(output)
                i = index
            }
            i += 1
            return { value: res, index: i }
        }

        if (current === 'i') {
            let j = i
            while (data[j] !== 0x65) {
                j += 1
            }
            const num = parseInt(data.toString('ascii', i + 1, j))
            return { value: num, index: j + 1 }
        }

        let j = i
        while (data[j] !== 0x3A) {
            j += 1
        }
        const length = parseInt(data.toString('ascii', i, j))
        const subStr = data.toString('ascii', j + 1, j + 1 + length)
        return { value: subStr, index: j + 1 + length }
    }

    return { value: res, index: i }
}

module.exports = { parseMetadata }