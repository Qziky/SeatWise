# SeatWise Next.js 全平台 Web 应用 Spec

## Why
现有目录中已有《排座位助手功能调研》，明确了面向中国中小学教师的排座位助手需要兼顾效率、公平、健康、规则解释与导出打印。需要基于 Next.js 技术栈制定一个可落地的全平台 Web 应用开发计划，优先交付可用 MVP，并为后续智能排座、轮换历史和家校沟通扩展留下空间。

## What Changes
- 使用 Next.js 技术栈规划并实现一个响应式全平台 Web 应用，覆盖桌面端、平板端和移动端核心体验。
- 建立 SeatWise 的核心产品信息架构：班级与学生档案、教室布局、排座规则、智能生成、手动微调、导出打印、历史记录。
- 第一阶段聚焦 MVP：本地可用的班级数据管理、基础教室布局、规则化座位生成、多方案对比、拖拽微调和导出入口。
- 采用前端优先的实现策略，先完成可交互原型与本地数据持久化，再根据需要接入后端、认证与数据库。
- 保持隐私优先：学生视力、健康、行为备注等敏感字段默认仅教师视角可见。

## Impact
- Affected specs: SeatWise 全平台 Web 应用、排座位助手 MVP、Next.js 前端架构、座位生成规则引擎
- Affected code: Next.js App Router 页面、核心业务组件、座位生成逻辑、数据模型、导入导出模块、响应式样式系统

## ADDED Requirements
### Requirement: Next.js 全平台应用骨架
The system SHALL provide a Next.js based web application that works across desktop, tablet, and mobile browsers.

#### Scenario: 首次打开应用
- **WHEN** 用户访问应用首页
- **THEN** 系统应展示 SeatWise 的产品定位、核心价值、主要功能入口和开始使用按钮

#### Scenario: 跨设备访问
- **WHEN** 用户在桌面端、平板端或移动端访问应用
- **THEN** 系统应根据屏幕尺寸提供可用的响应式布局

### Requirement: 班级与学生档案管理
The system SHALL allow teachers to create classes and manage student profiles needed for seating decisions.

#### Scenario: 创建班级
- **WHEN** 教师创建一个班级
- **THEN** 系统应保存班级名称、年级、学期、座位布局和学生列表

#### Scenario: 维护学生信息
- **WHEN** 教师录入或编辑学生资料
- **THEN** 系统应支持姓名、学号、性别、身高、视力情况、标签、备注和特殊需求字段

### Requirement: 学生导入能力
The system SHALL provide practical import options for quickly creating a class roster.

#### Scenario: 复制粘贴导入
- **WHEN** 教师从表格中复制学生名单并粘贴到导入区域
- **THEN** 系统应解析姓名、学号、性别等基础字段，并允许教师确认后导入

#### Scenario: 文件导入入口
- **WHEN** 教师选择 CSV 或 Excel 导入
- **THEN** 系统应提供导入入口和字段映射流程，确保后续实现可以接入真实解析逻辑

### Requirement: 教室布局编辑
The system SHALL let teachers configure a classroom seating layout before generating a seating chart.

#### Scenario: 创建行列布局
- **WHEN** 教师设置行数、列数和讲台方向
- **THEN** 系统应生成对应的座位网格

#### Scenario: 标记特殊座位区域
- **WHEN** 教师标记靠窗、靠门、反光、后排、边缘或空座
- **THEN** 系统应在座位生成与规则提示中使用这些座位属性

### Requirement: 排座规则配置
The system SHALL provide teacher-friendly controls for configuring seating rules without requiring algorithm knowledge.

#### Scenario: 启用规则模板
- **WHEN** 教师选择视力优先、公平轮换、纪律稳定、学习互助或考试随机模板
- **THEN** 系统应应用对应的规则权重和约束配置

#### Scenario: 设置关系规则
- **WHEN** 教师设置两个学生不能同桌或尽量分开
- **THEN** 系统应在生成座位时优先避免违反该关系规则

### Requirement: 智能座位生成
The system SHALL generate multiple seating chart candidates based on students, layout, and rules.

#### Scenario: 生成候选方案
- **WHEN** 教师点击生成座位表
- **THEN** 系统应生成至少 3 个候选方案，并展示每个方案的规则满足情况与风险提示

#### Scenario: 规则冲突提示
- **WHEN** 某些规则无法同时满足
- **THEN** 系统应展示未满足规则和简短原因，帮助教师理解取舍

### Requirement: 手动微调与锁定
The system SHALL allow teachers to manually adjust generated seating charts.

#### Scenario: 拖拽换座
- **WHEN** 教师拖拽学生到另一个座位
- **THEN** 系统应交换或移动学生，并重新检查规则冲突

#### Scenario: 锁定座位
- **WHEN** 教师锁定某个学生或座位
- **THEN** 系统应在重新生成其他座位时保留锁定结果

### Requirement: 座位表查看与导出
The system SHALL provide multiple viewing and export modes for classroom use.

#### Scenario: 教师版查看
- **WHEN** 教师查看座位表
- **THEN** 系统应显示学生姓名、标签、备注和规则提示等教师管理信息

#### Scenario: 学生版或打印版查看
- **WHEN** 教师切换到学生版或打印版
- **THEN** 系统应隐藏敏感标签和备注，仅展示适合公开展示的信息

### Requirement: 轮换与历史记录
The system SHALL keep seating chart history to support fairness and explanation.

#### Scenario: 保存座位版本
- **WHEN** 教师确认一个座位表
- **THEN** 系统应保存该版本的时间、规则配置、座位分布和调整说明

#### Scenario: 查看轮换风险
- **WHEN** 教师查看历史记录
- **THEN** 系统应提示长期后排、长期边缘或长期同桌等公平风险

### Requirement: 隐私保护
The system SHALL prevent sensitive student information from appearing in public or parent-facing views by default.

#### Scenario: 切换公开视图
- **WHEN** 教师切换到学生版、家长沟通版或投屏视图
- **THEN** 系统应隐藏视力详情、健康备注、行为标签和其他敏感字段

## MODIFIED Requirements
### Requirement: 调研结论落地为 MVP 范围
调研文档中的完整功能建议应被拆分为 MVP 与后续阶段。MVP SHALL prioritize 班级学生档案、基础教室布局、规则配置、候选方案生成、手动微调、冲突提示、导出入口和历史记录，不应在第一阶段实现完整教务系统、深度学籍系统接入或家长端完整开放。

## REMOVED Requirements
### Requirement: 第一阶段完整学校教务系统
**Reason**: 完整教务系统会显著扩大项目范围，偏离排座位助手的核心价值。
**Migration**: 将出勤、作业、积分、代课老师模式等能力放入后续扩展阶段，MVP 仅保留与座位表直接相关的数据和入口。
