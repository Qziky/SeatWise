# SeatWise 智能排座位助手

SeatWise 是一个面向中国中小学班主任的智能排座位助手 MVP。它帮助老师基于视力、身高、同桌关系、公平轮换和隐私展示，在浏览器中生成可解释、可微调、可导出的班级座位表。

## 当前进度

项目已完成可用 MVP：

- Next.js App Router + TypeScript + Tailwind CSS 应用骨架
- 首页与响应式工作台，适配桌面、平板、手机
- 班级信息、学生档案、本地浏览器持久化
- 学生名单复制粘贴导入，CSV / Excel 导入入口与字段映射预留
- 教室行列布局、讲台方向、空座和特殊座位区域标记
- 视力优先、身高遮挡、男女搭配、公平轮换、避免同桌等规则配置
- 视力优先、公平轮换、纪律稳定、学习互助、考试随机规则模板
- 一次生成 3 个候选方案，并展示评分、冲突原因和复核提示
- 座位表拖拽微调、学生锁定、座位锁定、重排未锁定座位
- 教师版、学生版、打印版视图，公开视图默认隐藏敏感字段
- PDF / 打印、图片、Excel / CSV 导出入口
- 座位版本历史、学生座位轨迹、长期后排 / 边缘 / 同桌风险提示
- 单元测试与组件测试，覆盖导入、布局、规则、生成、隐私和视图切换

## 技术栈

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Zustand persist
- @dnd-kit 拖拽
- Vitest + Testing Library
- ESLint

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://127.0.0.1:3000
```

## 可用脚本

```bash
npm run dev        # 启动开发服务器
npm run build      # 生产构建
npm run start      # 启动生产服务
npm run lint       # ESLint 检查
npm run typecheck  # TypeScript 类型检查
npm test           # 运行测试
```

## 质量验证

当前已通过：

```bash
npm audit --omit=dev
npm run lint
npm run typecheck
npm test
npm run build
```

测试结果：6 个测试文件、11 个用例通过。

## 项目结构

```text
src/
  app/                 Next.js App Router 页面
  components/          工作台、学生、布局、规则、生成、历史、导出组件
  lib/                 类型、导入解析、布局工具、规则模板、排座引擎、导出工具
  store/               Zustand 本地持久化状态
  test/                测试初始化
  types/               全局类型声明
.trae/specs/           产品规格、任务和验收清单
```

## 隐私说明

SeatWise MVP 默认采用浏览器本地存储，不接入后端、登录、云同步或学校系统。学生视力、健康备注、行为标签、特殊需求等敏感信息仅在教师版显示；学生版和打印版默认只展示姓名、学号和性别。

## GitHub 发布准备

本项目已准备作为 Git 仓库发布。创建 GitHub 仓库后，可执行：

```bash
git remote add origin https://github.com/<your-name>/<repo-name>.git
git branch -M main
git push -u origin main
```

## 后续路线

- 接入真实 Excel 解析和更完整的字段映射
- 增加后端、账号、数据库和多班级云同步
- 增加家长沟通说明导出与分享链接
- 加强排座算法的可解释性和历史轮换策略
- 增加端到端测试和部署流水线
