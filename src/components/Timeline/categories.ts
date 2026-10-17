import type { EventCategory } from "../../data/schema";

/** 时间轴事件分类的颜色与名称（PLAN §4.2：不同分类使用不同颜色和标记样式）。 */
export const CATEGORY_STYLE: Record<EventCategory, { label: string; color: string }> = {
  geology: { label: "地质", color: "#c9a96e" },
  life: { label: "生命演化", color: "#68d391" },
  extinction: { label: "灾变 / 灭绝", color: "#fc8181" },
  climate: { label: "气候环境", color: "#63b3ed" },
  human: { label: "人类演化", color: "#f6ad55" },
  civilization: { label: "文明历史", color: "#ecc94b" },
};
