/** 从部署根路径加载 public/ 下的静态 JSON 数据。 */
export async function fetchStaticJson(url: string): Promise<unknown> {
  const res = await fetch(`${import.meta.env.BASE_URL}${url}`);
  if (!res.ok) throw new Error(`加载失败（HTTP ${res.status}）：${url}`);
  return res.json();
}
