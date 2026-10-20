(() => {
  const vowels = {
    "ri": "\u098b", "oi": "\u0990", "OI": "\u0990", "ou": "\u0994", "OU": "\u0994", "ee": "\u0988", "oo": "\u098a",
    "o": "\u0985", "a": "\u0986", "A": "\u0986", "i": "\u0987", "I": "\u0988", "u": "\u0989", "U": "\u098a", "e": "\u098f", "E": "\u098f", "O": "\u0993"
  };

  const kars = {
    "ri": "\u09c3", "oi": "\u09c8", "OI": "\u09c8", "ou": "\u09cc", "OU": "\u09cc", "ee": "\u09c0", "oo": "\u09c2",
    "a": "\u09be", "A": "\u09be", "i": "\u09bf", "I": "\u09c0", "u": "\u09c1", "U": "\u09c2", "e": "\u09c7", "E": "\u09c7", "O": "\u09cb"
  };

  const conjunctSpecials = {
    "kkh": "\u0995\u09cd\u09b7", "kSh": "\u0995\u09cd\u09b7", "cch": "\u099a\u09cd\u099b", "cchh": "\u099a\u09cd\u099b",
    "Ngkh": "\u0999\u09cd\u0996", "ngkh": "\u0999\u09cd\u0996", "Nggh": "\u0999\u09cd\u0998", "nggh": "\u0999\u09cd\u0998",
    "Ngk": "\u0999\u09cd\u0995", "ngk": "\u0999\u09cd\u0995", "Ngg": "\u0999\u09cd\u0997", "ngg": "\u0999\u09cd\u0997",
    "jng": "\u099c\u09cd\u099e", "jny": "\u099c\u09cd\u099e", "ggy": "\u099c\u09cd\u099e",
    "ShTh": "\u09b7\u09cd\u09a0", "ShT": "\u09b7\u09cd\u099f", "shch": "\u09b6\u09cd\u099a",
    "shth": "\u09b8\u09cd\u09a5", "sht": "\u09b8\u09cd\u09a4", "sph": "\u09b8\u09cd\u09ab"
  };

  const multiConsonants = {
    "kh": "\u0996", "gh": "\u0998", "Ng": "\u0999", "ch": "\u099b", "jh": "\u099d", "NG": "\u099e",
    "Th": "\u09a0", "Dh": "\u09a2", "th": "\u09a5", "dh": "\u09a7", "ph": "\u09ab", "bh": "\u09ad",
    "sh": "\u09b6", "Sh": "\u09b7", "Rh": "\u09dd", "ng": "\u0982"
  };

  const singleConsonants = {
    "k": "\u0995", "g": "\u0997", "c": "\u099a", "j": "\u099c", "T": "\u099f", "D": "\u09a1",
    "N": "\u09a3", "t": "\u09a4", "d": "\u09a6", "n": "\u09a8", "p": "\u09aa", "f": "\u09ab",
    "b": "\u09ac", "v": "\u09ad", "m": "\u09ae", "z": "\u09af", "y": "\u09df", "Y": "\u09df",
    "r": "\u09b0", "l": "\u09b2", "s": "\u09b8", "S": "\u09b6", "h": "\u09b9", "R": "\u09dc"
  };

  const digits = {
    "0": "\u09e6", "1": "\u09e7", "2": "\u09e8", "3": "\u09e9", "4": "\u09ea",
    "5": "\u09eb", "6": "\u09ec", "7": "\u09ed", "8": "\u09ee", "9": "\u09ef"
  };

  const parseAvroPhonetic = (str) => {
    if (!str) return "";
    let out = "";
    let i = 0;
    let lastWasConsonant = false;

    while (i < str.length) {
      if (str.slice(i, i + 2) === "t`") {
        out += "\u09ce";
        i += 2;
        lastWasConsonant = false;
        continue;
      }
      if (str.slice(i, i + 2) === "..") {
        out += "\u0964";
        i += 2;
        lastWasConsonant = false;
        continue;
      }
      if (str.slice(i, i + 2) === ",,") {
        out += "\u09cd";
        i += 2;
        lastWasConsonant = true;
        continue;
      }
      if (str[i] === "^" || str.slice(i, i + 2) === ":$") {
        out += "\u0981";
        i += (str[i] === "^" ? 1 : 2);
        lastWasConsonant = false;
        continue;
      }
      if (str[i] === ":") {
        out += "\u0983";
        i += 1;
        lastWasConsonant = false;
        continue;
      }

      if (digits[str[i]]) {
        out += digits[str[i]];
        i += 1;
        lastWasConsonant = false;
        continue;
      }

      const match4 = str.slice(i, i + 4);
      const match3 = str.slice(i, i + 3);
      const match2 = str.slice(i, i + 2);
      const match1 = str[i];

      if (conjunctSpecials[match4]) {
        out += conjunctSpecials[match4];
        i += 4;
        lastWasConsonant = true;
        continue;
      }
      if (conjunctSpecials[match3]) {
        out += conjunctSpecials[match3];
        i += 3;
        lastWasConsonant = true;
        continue;
      }

      if (lastWasConsonant) {
        if (kars[match2]) {
          out += kars[match2];
          i += 2;
          lastWasConsonant = false;
          continue;
        }
        if (kars[match1]) {
          out += kars[match1];
          i += 1;
          lastWasConsonant = false;
          continue;
        }
        if (match1 === "o") {
          i += 1;
          lastWasConsonant = false;
          continue;
        }
        if (match1 === "r") {
          out += "\u09cd\u09b0";
          i += 1;
          lastWasConsonant = true;
          continue;
        }
        if (match1 === "y" || match1 === "z") {
          out += "\u09cd\u09af";
          i += 1;
          lastWasConsonant = true;
          continue;
        }
        if (match1 === "w") {
          out += "\u09cd\u09ac";
          i += 1;
          lastWasConsonant = true;
          continue;
        }
      }

      if (!lastWasConsonant) {
        if (vowels[match2]) {
          out += vowels[match2];
          i += 2;
          lastWasConsonant = false;
          continue;
        }
        if (vowels[match1]) {
          out += vowels[match1];
          i += 1;
          lastWasConsonant = false;
          continue;
        }
      }

      if (match1 === "r" && i + 1 < str.length) {
        const next2 = str.slice(i + 1, i + 3);
        const next1 = str[i + 1];
        if (multiConsonants[next2] || singleConsonants[next1]) {
          out += "\u09b0\u09cd";
          i += 1;
          lastWasConsonant = false;
          continue;
        }
      }

      const matchedConsonant = multiConsonants[match2] || singleConsonants[match1];
      const step = multiConsonants[match2] ? 2 : (singleConsonants[match1] ? 1 : 0);

      if (matchedConsonant) {
        out += lastWasConsonant ? "\u09cd" + matchedConsonant : matchedConsonant;
        i += step;
        lastWasConsonant = true;
        continue;
      }

      if (match1 === "w") {
        out += lastWasConsonant ? "\u09cd\u09ac" : "\u0993";
        i += 1;
        lastWasConsonant = !lastWasConsonant;
        continue;
      }

      out += match1;
      i += 1;
      lastWasConsonant = false;
    }

    return out;
  };

  window.TypeNextAvro = { parse: parseAvroPhonetic };
  window.parseAvroPhonetic = parseAvroPhonetic;
})();