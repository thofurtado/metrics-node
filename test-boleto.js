const digits = '826100000007823200970916103665416501213755432134';
const isMod10 = ['6', '7'].includes(digits[2]);
console.log('isMod10:', isMod10);

function mod10(data) {
  let sum = 0;
  let weight = 2;
  for (let i = data.length - 1; i >= 0; i--) {
    let res = parseInt(data[i]) * weight;
    if (res > 9) res = Math.floor(res / 10) + (res % 10);
    sum += res;
    weight = weight === 2 ? 1 : 2;
  }
  const remainder = sum % 10;
  const digit = 10 - remainder;
  return digit === 10 ? 0 : digit;
}

function mod11(data) {
  let sum = 0;
  let weight = 2;
  for (let i = data.length - 1; i >= 0; i--) {
    sum += parseInt(data[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  if (remainder === 0 || remainder === 1) return 0;
  if (remainder === 10) return 1;
  return 11 - remainder;
}

const blocks = [
  { data: digits.substring(0, 11), cd: digits.substring(11, 12) },
  { data: digits.substring(12, 23), cd: digits.substring(23, 24) },
  { data: digits.substring(24, 35), cd: digits.substring(35, 36) },
  { data: digits.substring(36, 47), cd: digits.substring(47, 48) }
];

blocks.forEach((b, i) => {
  const m10 = mod10(b.data);
  const m11 = mod11(b.data);
  console.log(`Block ${i+1}: data=${b.data}, cd=${b.cd}, m10=${m10}, m11=${m11}`);
});
