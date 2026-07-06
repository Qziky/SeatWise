# 开源发布清单

发布到公开仓库前，请完成以下检查：

- [ ] README 能准确说明项目定位、功能、隐私边界和本地运行方式。
- [ ] LICENSE、CONTRIBUTING.md、CODE_OF_CONDUCT.md、SECURITY.md 和 SUPPORT.md 已存在。
- [ ] Issue 模板、PR 模板和 GitHub Actions CI 已存在。
- [ ] `npm ci` 成功。
- [ ] `npm run ci` 成功。
- [ ] `git diff --check` 无错误。
- [ ] `git status --short` 中没有意外生成物、缓存、日志或真实学生数据。
- [ ] 截图、演示数据和 issue 样例均已脱敏。
- [ ] GitHub 仓库描述、主题、Security Advisory 和默认分支保护已配置。

发布后建议创建 `v0.1.0` tag，并把 CHANGELOG.md 中的版本说明复制到 GitHub Release。
