import { describe, expect, it } from "vitest";
import { parseStudentPaste } from "@/lib/importer";

describe("parseStudentPaste", () => {
  it("parses pasted roster with Chinese headers", () => {
    const result = parseStudentPaste(
      "姓名\t学号\t性别\t身高\t视力\t标签\t备注\t特殊需求\n张浩\t01\t男\t158\t重点照顾\t需要靠前、近期观察\t家长已沟通\t前排"
    );

    expect(result.rows).toHaveLength(1);
    expect(result.detectedHeaders).toContain("姓名");
    expect(result.rows[0]).toMatchObject({
      name: "张浩",
      studentNo: "01",
      gender: "男",
      heightCm: 158,
      vision: "severe",
      tags: ["需要靠前", "近期观察"],
      remark: "家长已沟通",
      specialNeeds: "前排"
    });
  });

  it("parses roster without headers using the default column order", () => {
    const result = parseStudentPaste("李萌,02,女,145,正常,小组带动");

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("李萌");
    expect(result.rows[0].vision).toBe("normal");
  });
});
