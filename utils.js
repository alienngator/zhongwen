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
            if (line_num >= 35) {
                const data = line.split(' ');
                const trad = data[0];
                const smpl = data[1];
                Utils.addToIndex(index, trad, offset);
                if (smpl !== trad) {
                    Utils.addToIndex(index, smpl, offset);
                }
            }
            offset = offset + line.length + 1
        });
        const text = Array.from(index.values()).join('\n');
        console.log(text);
        return text;
    }
}
