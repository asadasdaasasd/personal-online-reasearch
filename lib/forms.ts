import type { Kind } from "./domain";
export type Field = {
  key: string;
  label: string;
  type?: "textarea" | "date" | "number" | "select" | "json";
  options?: string[];
};
export const fields: Record<Kind, Field[]> = {
  projects: [
    { key: "description", label: "项目描述", type: "textarea" },
    { key: "dueDate", label: "预计结束日期", type: "date" },
  ],
  milestones: [
    { key: "description", label: "详细描述", type: "textarea" },
    { key: "dueDate", label: "预计完成日期", type: "date" },
    { key: "criteria", label: "完成标准", type: "textarea" },
  ],
  tasks: [
    { key: "description", label: "任务描述", type: "textarea" },
    {
      key: "priority",
      label: "优先级",
      type: "select",
      options: ["高", "中", "低"],
    },
    { key: "dueDate", label: "截止日期", type: "date" },
    { key: "criteria", label: "完成标准", type: "textarea" },
  ],
  logs: [
    { key: "goals", label: "今日研究目标", type: "textarea" },
    { key: "work", label: "今日完成的研究工作", type: "textarea" },
    { key: "problems", label: "遇到的问题", type: "textarea" },
    { key: "solutions", label: "已尝试的解决方法", type: "textarea" },
    { key: "learning", label: "今日研究收获", type: "textarea" },
    { key: "tomorrow", label: "明日研究计划", type: "textarea" },
    { key: "hours", label: "科研时长（小时）", type: "number" },
  ],
  experiments: [
    { key: "purpose", label: "实验目的", type: "textarea" },
    { key: "hypothesis", label: "实验假设", type: "textarea" },
    { key: "environment", label: "实验环境", type: "textarea" },
    { key: "method", label: "实验方法", type: "textarea" },
    {
      key: "parameters",
      label: "参数配置（JSON，可使用下方键值表）",
      type: "json",
    },
    { key: "configText", label: "其他格式的原始配置", type: "textarea" },
    { key: "results", label: "实验结果", type: "textarea" },
    { key: "metrics", label: "自定义性能指标（JSON）", type: "json" },
    { key: "conclusion", label: "实验结论", type: "textarea" },
    { key: "problems", label: "遇到的问题", type: "textarea" },
    { key: "next", label: "下一步改进", type: "textarea" },
    { key: "commit", label: "代码版本 / Git Commit" },
  ],
  achievements: [
    {
      key: "type",
      label: "成果类型",
      type: "select",
      options: [
        "理论研究",
        "算法开发",
        "仿真实验",
        "技术报告",
        "论文与学术成果",
        "阶段总结",
        "其他",
      ],
    },
    { key: "completedDate", label: "完成日期", type: "date" },
    { key: "summary", label: "成果摘要", type: "textarea" },
    { key: "tags", label: "标签（逗号分隔）" },
    { key: "externalLink", label: "外部资料 / 视频链接" },
  ],
  reviews: [
    { key: "work", label: "本周完成的主要工作", type: "textarea" },
    { key: "progress", label: "最重要的研究进展", type: "textarea" },
    { key: "problems", label: "尚未解决的问题", type: "textarea" },
    { key: "next", label: "下周研究计划", type: "textarea" },
  ],
};
