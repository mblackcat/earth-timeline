import type { EventCategory } from "../../data/schema";
import { INK } from "../../scene/Ink/inkPalette";

/** 时间轴事件分类的颜色与名称。纸面上降饱和；灾变 / 灭绝用红笔。 */
export const CATEGORY_STYLE: Record<EventCategory, { label: string; color: string }> = {
  geology: { label: "地质", color: "#8a6f3e" },
  life: { label: "生命演化", color: "#3f7a4a" },
  extinction: { label: "灾变 / 灭绝", color: INK.mark },
  climate: { label: "气候环境", color: "#3a6a8f" },
  human: { label: "人类演化", color: "#a0622a" },
  civilization: { label: "文明历史", color: "#7a6a2a" },
};
