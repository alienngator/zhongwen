'use strict';

export class Utils {
    static addToIndex(index, char, offset) {
        const currVal = index.has(char) ? index.get(char) : char;
        index.set(char, currVal + ',' + offset);
    }

    static genIndex(wordDict) {
        const index = new Map();
        const lines = wordDict.split('\n');
        let offset = 0;
        lines.forEach((line, line_num) => {
            if (line_num >= 34) {
                const data = line.split(' ');
                const trad = data[0];
                const smpl = data[1];
                Utils.addToIndex(index, trad, offset);
                if (smpl !== trad) {
                    Utils.addToIndex(index, smpl, offset);
                }
            }
            offset = offset + line.length + 1;
        });
        const idxArr = Array.from(index.values());
        idxArr.splice(-2, 2);
        const text = idxArr.sort().join('\n');
        console.log(text);
        return text;
    }
}
