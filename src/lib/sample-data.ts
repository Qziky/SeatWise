import { createGridLayout } from "@/lib/layout";
import { defaultRuleConfig } from "@/lib/rules";
import type { ClassRoom, HistoryEntry, SeatingPlan, SeatingRuleConfig, Student } from "@/lib/types";

export const sampleStudents: Student[] = [
  {
    id: "stu-zhang-hao",
    name: "张浩",
    studentNo: "01",
    gender: "男",
    heightCm: 158,
    vision: "severe",
    tags: ["需要靠前", "近期观察"],
    remark: "右眼近视，家长已沟通过希望避开反光。",
    specialNeeds: "优先前排，避开反光"
  },
  {
    id: "stu-li-meng",
    name: "李萌",
    studentNo: "02",
    gender: "女",
    heightCm: 145,
    vision: "normal",
    tags: ["小组带动"],
    remark: "课堂专注度高，适合作为同桌带动。",
    specialNeeds: ""
  },
  {
    id: "stu-wang-yu",
    name: "王宇",
    studentNo: "03",
    gender: "男",
    heightCm: 168,
    vision: "mild",
    tags: ["高个", "适合后排"],
    remark: "身高较高，避免长期坐前排中央。",
    specialNeeds: ""
  },
  {
    id: "stu-chen-xin",
    name: "陈欣",
    studentNo: "04",
    gender: "女",
    heightCm: 151,
    vision: "severe",
    tags: ["需要靠前"],
    remark: "看投影容易吃力。",
    specialNeeds: "靠前"
  },
  {
    id: "stu-zhao-lei",
    name: "赵磊",
    studentNo: "05",
    gender: "男",
    heightCm: 162,
    vision: "normal",
    tags: ["容易分心"],
    remark: "和熟人同桌时容易聊天。",
    specialNeeds: ""
  },
  {
    id: "stu-sun-yue",
    name: "孙悦",
    studentNo: "06",
    gender: "女",
    heightCm: 149,
    vision: "mild",
    tags: ["安静"],
    remark: "",
    specialNeeds: ""
  },
  {
    id: "stu-zhou-rui",
    name: "周睿",
    studentNo: "07",
    gender: "男",
    heightCm: 155,
    vision: "normal",
    tags: ["互助搭配"],
    remark: "适合与学习节奏慢的同学同组。",
    specialNeeds: ""
  },
  {
    id: "stu-wu-jia",
    name: "吴佳",
    studentNo: "08",
    gender: "女",
    heightCm: 153,
    vision: "normal",
    tags: ["近期需关注"],
    remark: "近期课堂发言变少。",
    specialNeeds: ""
  },
  {
    id: "stu-xu-nuo",
    name: "徐诺",
    studentNo: "09",
    gender: "男",
    heightCm: 170,
    vision: "normal",
    tags: ["高个"],
    remark: "",
    specialNeeds: ""
  },
  {
    id: "stu-he-qing",
    name: "何晴",
    studentNo: "10",
    gender: "女",
    heightCm: 147,
    vision: "severe",
    tags: ["需要靠前"],
    remark: "不宜靠窗强光位置。",
    specialNeeds: "避开靠窗反光"
  },
  {
    id: "stu-luo-yi",
    name: "罗一",
    studentNo: "11",
    gender: "男",
    heightCm: 154,
    vision: "unknown",
    tags: ["转入"],
    remark: "新转入，先安排方便老师观察的位置。",
    specialNeeds: "便于观察"
  },
  {
    id: "stu-guo-lin",
    name: "郭琳",
    studentNo: "12",
    gender: "女",
    heightCm: 156,
    vision: "normal",
    tags: ["小组带动"],
    remark: "",
    specialNeeds: ""
  },
  {
    id: "stu-ma-ke",
    name: "马克",
    studentNo: "13",
    gender: "男",
    heightCm: 160,
    vision: "mild",
    tags: ["活跃"],
    remark: "参与度高，但和赵磊同桌时容易分心。",
    specialNeeds: ""
  },
  {
    id: "stu-tang-shi",
    name: "唐诗",
    studentNo: "14",
    gender: "女",
    heightCm: 152,
    vision: "normal",
    tags: ["安静"],
    remark: "",
    specialNeeds: ""
  },
  {
    id: "stu-han-bo",
    name: "韩博",
    studentNo: "15",
    gender: "男",
    heightCm: 166,
    vision: "normal",
    tags: ["高个", "小组稳定"],
    remark: "",
    specialNeeds: ""
  },
  {
    id: "stu-lin-xi",
    name: "林夕",
    studentNo: "16",
    gender: "女",
    heightCm: 148,
    vision: "mild",
    tags: ["需要靠前"],
    remark: "",
    specialNeeds: "前半区"
  }
];

export const sampleRules: SeatingRuleConfig = {
  ...defaultRuleConfig,
  relationships: [
    {
      id: "rel-zhao-ma",
      type: "avoid-desk",
      studentAId: "stu-zhao-lei",
      studentBId: "stu-ma-ke",
      note: "两人同桌时容易聊天"
    },
    {
      id: "rel-zhang-he",
      type: "keep-apart",
      studentAId: "stu-zhang-hao",
      studentBId: "stu-he-qing",
      note: "两名重点视力照顾学生尽量不要挤在同一区域"
    }
  ]
};

export const initialClassroom: ClassRoom = {
  id: "class-sample",
  name: "三年级 2 班",
  grade: "三年级",
  term: "2026 春季",
  layout: createGridLayout(6, 8, "top"),
  students: sampleStudents,
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z"
};

export const emptyPlanScore = {
  total: 0,
  health: 0,
  height: 0,
  discipline: 0,
  gender: 0,
  fairness: 0,
  balance: 0
};

export const emptySelectedPlan: SeatingPlan | null = null;

export const initialHistory: HistoryEntry[] = [];
