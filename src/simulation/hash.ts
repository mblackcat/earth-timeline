/** FNV-1a 32 位字符串哈希：散布与抽样用的固定种子（相同键永远得到相同结果）。 */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
