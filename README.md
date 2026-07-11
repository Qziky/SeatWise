# SeatWise 智能排座位助手

SeatWise 是一个面向中国中小学班主任的智能排座位助手 MVP。它帮助老师基于视力、身高、同桌关系、公平轮换和隐私展示，在浏览器中生成可解释、可微调、可导出的班级座位表。

## 功能

- 班级信息、学生档案和座位历史保存在浏览器本地。
- 支持复制粘贴导入学生名单，识别姓名、学号、性别、身高、视力、标签、备注和特殊需求。
- 支持配置教室行列、讲台方向、空座和特殊座位区域。
- 内置视力优先、身高遮挡、男女搭配、公平轮换、避免同桌等规则。
- 提供视力优先、公平轮换、纪律稳定、学习互助、考试随机等规则模板。
- 一次生成 3 个候选方案，并展示评分、冲突原因和复核提示。
- 支持拖拽微调座位、锁定学生、锁定座位和重排未锁定座位。
- 提供教师版、学生版和打印版视图；公开视图默认隐藏敏感字段。
- 支持打印/PDF、SVG 图片和带公式注入防护的 UTF-8 CSV 导出。
- 提供座位版本历史、学生座位轨迹、长期后排/边缘/同桌风险提示。

## 技术栈

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Zustand persist
- @dnd-kit 拖拽
- Vitest + Testing Library
- ESLint

## 环境要求

- Node.js 22.9–22.x 或 24.x
- npm 11.16 或更高版本

`package.json` 中保留了 `private: true`，用于避免把这个应用误发布到 npm；这不影响将仓库作为开源项目发布。

Next.js 15.5.20 仍固定依赖 PostCSS 8.4.31；项目仅对 Next 子依赖覆盖到 PostCSS 8.5.16，以修复 `GHSA-qx2v-qp2m-jg93`。升级 Next 后应重新审计并优先移除此覆盖。

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
npm run test:coverage # 运行测试并检查覆盖率门槛
npm run test:e2e   # 运行 Chromium 端到端测试
npm run check      # lint + typecheck + coverage
npm run ci         # check + build + 生产依赖审计
npm run cleanup:windows # 清理 Windows 本地 Playwright/Next 残留进程和临时快照
```

## 项目结构

```text
src/
  app/          Next.js App Router 页面
  components/   工作台、学生、布局、规则、生成、历史、导出组件
  lib/          类型、导入解析、布局工具、规则模板、排座引擎、导出工具
  store/        Zustand 本地持久化状态
  test/         测试初始化
  types/        全局类型声明
e2e/            Playwright 关键流程测试
```

## 隐私说明

SeatWise MVP 默认采用浏览器本地存储，不接入后端、登录、云同步或学校系统。学生视力、健康备注、行为标签、特殊需求等敏感信息仅在教师版显示；学生版和打印版默认只展示姓名、学号和性别。

本地数据以明文保存在当前浏览器配置中，公开视图不是访问控制。请勿在不受信任或多人共用的浏览器配置中保存真实学生资料；恢复示例数据前可先导出本地 JSON 备份。

公开演示、截图或提交 issue 时，请避免上传真实学生姓名、学号、健康情况、行为标签、备注或其他可识别个人身份的信息。

## 开源发布检查

发布前建议在干净工作区执行：

```bash
npm ci
npm run ci
git status --short
```

当前仓库已包含：

- MIT 许可证
- 贡献指南
- 行为准则
- 安全披露说明
- 支持说明
- 变更日志
- GitHub Actions CI
- Issue 与 Pull Request 模板

创建 GitHub 仓库后，可执行：

```bash
git remote add origin https://github.com/<your-name>/<repo-name>.git
git branch -M main
git push -u origin main
```

## 贡献

欢迎提交 bug report、功能建议、文档改进和 Pull Request。开始前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 安全

如果你发现可能影响学生隐私或数据安全的问题，请按 [SECURITY.md](SECURITY.md) 中的方式报告。

## 支持

使用问题和功能建议请参考 [SUPPORT.md](SUPPORT.md)。

## 路线图

- 接入真实 Excel 解析和更完整的字段映射。
- 增加后端、账号、数据库和多班级云同步。
- 增加家长沟通说明导出与分享链接。
- 加强排座算法的可解释性和历史轮换策略。
- 增加端到端测试和部署流水线。

## 许可证

本项目基于 [MIT License](LICENSE) 开源。
