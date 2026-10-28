// 固定内容：分支、小等级、can-do 成就、XP 参数。数字都是【默认值】，原型测试后再调。

export const BRANCHES = {
  en: { name: '英语', skills: ['L', 'S', 'R', 'W', 'G'] },
  fr: { name: '法语', skills: ['L', 'S', 'R', 'W', 'G'] },
  career: { name: '职业', skills: [] },
  edu: { name: '学历', skills: [] },
};
export const SKILL_NAMES = { L: '听力', S: '口语', R: '阅读', W: '写作', G: '通用（词汇、语法）' };

export const XP = {
  passiveRate: 0.5,
  fullMinutes: 180, // 每天前 3 小时全额
  halfMinutes: 360, // 3–6 小时减半，之后不计
  firstOfDay: 5,
  planComplete: 10,
  focusBonus: 0.2,
  perLevel: 1000,
  freezesPerWeek: 2,
  counters: { application: 5, coffee: 15, interview: 30 },
};

// 熟练度估算：被动沉浸按 30% 计入
export const PROFICIENCY_PASSIVE_RATE = 0.3;
// 校准后，每个子技能每提升一级大约需要的小时数（占位）
export const HOURS_PER_LEVEL_PER_SKILL = 60;

// 法语小等级（累计有效小时数，占位，待校准）
export const SUBLEVELS = [
  { key: 'A1.1', from: 0, nclc: 1 },
  { key: 'A1.2', from: 40, nclc: 2 },
  { key: 'A2.1', from: 80, nclc: 3 },
  { key: 'A2.2', from: 140, nclc: 4 },
  { key: 'B1.1', from: 200, nclc: 5 },
  { key: 'B1.2', from: 300, nclc: 6 },
  { key: 'B2.1', from: 400, nclc: 7 },
  { key: 'B2.2', from: 500, nclc: 8 },
];

export const CAN_DO = {
  A1: ['能用法语做简单的自我介绍', '能点一杯咖啡、问价格', '能听懂数字、日期和时间'],
  A2: ['能看懂公交时刻表和简单通知', '能写一封简单的请假邮件', '能聊自己的日常和爱好'],
  B1: ['能听懂天气预报的大意', '能讲清楚自己的工作经历', '能看懂一篇简单的新闻'],
  B2: ['能听懂一期新闻播客的大部分内容', '能在电话里预约服务', '能写一篇有论点的短文'],
};

export const CAREER_COUNTERS = [
  { key: 'application', name: '投递' },
  { key: 'coffee', name: 'Coffee chat / 内推' },
  { key: 'interview', name: '面试' },
];
