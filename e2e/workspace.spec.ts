import { expect, test } from "@playwright/test";

const importFixture =
  "姓名\t学号\t性别\t身高\t视力\n秦朗\t17\t男\t159\t轻度关注\n叶安\t18\t女\t146\t重点照顾";

test.beforeEach(async ({ page }) => {
  await page.goto("/workspace");
});

test("workspace responses include browser security headers", async ({ request }) => {
  const response = await request.get("/workspace");
  const headers = response.headers();

  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  if (process.env.CI) expect(headers["content-security-policy"]).not.toContain("'unsafe-eval'");
});

test("seat locks render and survive a reload", async ({ page }) => {
  await page.getByRole("button", { name: "生成方案" }).click();
  await page.getByTestId("seating-board-grid").getByRole("button", { name: /^1-1 / }).click();
  await page.getByRole("button", { name: "锁座位" }).click();

  await expect(page.getByRole("button", { name: "解锁座位" })).toBeVisible();
  await expect(page.getByText("工作区暂时无法显示")).toHaveCount(0);

  await page.reload();
  await page.getByRole("complementary").getByRole("button", { name: "生成" }).click();
  await page.getByTestId("seating-board-grid").getByRole("button", { name: /^1-1 / }).click();
  await expect(page.getByRole("button", { name: "解锁座位" })).toBeVisible();
});

test("editing a scoring input makes the current plan non-exportable", async ({ page }) => {
  await page.getByRole("button", { name: "生成方案" }).click();
  await page.getByRole("complementary").getByRole("button", { name: "学生" }).click();
  await page.getByRole("spinbutton", { name: "张浩 身高" }).fill("220");
  await page.getByRole("complementary").getByRole("button", { name: "生成" }).click();

  await expect(page.getByText(/当前方案仅供查看/)).toBeVisible();
  await expect(page.getByRole("button", { name: "确认保存" })).toBeDisabled();

  await page.getByRole("complementary").getByRole("button", { name: "导出" }).click();
  await expect(page.getByText("当前方案已过期，请重新生成后再导出。")).toBeVisible();
  await expect(page.getByRole("button", { name: "PDF / 打印" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "CSV" })).toBeDisabled();
});

test("re-importing the same roster reports conflicts instead of duplicating students", async ({ page }) => {
  await page.getByRole("complementary").getByRole("button", { name: "学生" }).click();
  const roster = page.getByRole("textbox", { name: "粘贴学生名单" });
  await roster.fill(importFixture);
  await page.getByRole("button", { name: "确认导入 2 名" }).click();
  await expect(page.getByRole("status")).toContainText("已导入 2 名学生");

  await roster.fill(importFixture);
  await page.getByRole("button", { name: "确认导入 2 名" }).click();
  await expect(page.getByRole("status")).toContainText("已导入 0 名学生，跳过 2 个重复学号");
  await expect(page.getByText("学生 18", { exact: true })).toBeVisible();
});

test("restoring sample data requires explicit confirmation", async ({ page }) => {
  const className = page.getByRole("textbox", { name: "班级名称" });
  await className.fill("不要覆盖的班级");
  await page.getByRole("button", { name: "恢复示例数据" }).click();

  const dialog = page.getByRole("alertdialog", { name: "恢复示例数据" });
  await expect(dialog).toContainText("此操作不可撤销");
  await expect(dialog.getByRole("button", { name: "导出备份" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "取消" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "恢复示例数据" })).toBeFocused();
  await expect(className).toHaveValue("不要覆盖的班级");

  await page.getByRole("button", { name: "恢复示例数据" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "确认覆盖" }).click();
  await expect(className).toHaveValue("三年级 2 班");
});

test("mobile navigation exposes the destructive reset with confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "导航" }).click();
  const resetButton = page.getByRole("button", { name: "恢复示例数据" });

  await expect(resetButton).toBeVisible();
  await resetButton.click();
  await expect(page.getByRole("alertdialog", { name: "恢复示例数据" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(resetButton).toBeFocused();
});

test("student and print views do not render sensitive student fields", async ({ page }) => {
  await page.getByRole("button", { name: "生成方案" }).click();
  await page.getByRole("tab", { name: "学生版" }).click();

  await expect(page.getByText("当前仅展示姓名、学号和性别。")).toBeVisible();
  await expect(page.getByText(/右眼近视|家长已沟通|特殊需求：/)).toHaveCount(0);
  await expect(page.getByText("方案评分")).toHaveCount(0);

  await page.getByRole("tab", { name: "打印版" }).click();
  await expect(page.getByText(/右眼近视|家长已沟通|特殊需求：/)).toHaveCount(0);
});
