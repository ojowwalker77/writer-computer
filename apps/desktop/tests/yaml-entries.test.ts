import { describe, expect, test } from "vite-plus/test";
import { parseYamlEntries, serializeYamlEntries } from "../src/lib/yaml-entries";

describe("parseYamlEntries", () => {
  test("parses simple key-value pairs", () => {
    const entries = parseYamlEntries("title: Hello\nauthor: Jane");
    expect(entries).toEqual([
      { key: "title", value: "Hello", isComplex: false },
      { key: "author", value: "Jane", isComplex: false },
    ]);
  });

  test("parses booleans and numbers", () => {
    const entries = parseYamlEntries("draft: false\nweight: 42\npi: 3.14");
    expect(entries).toEqual([
      { key: "draft", value: "false", isComplex: false },
      { key: "weight", value: "42", isComplex: false },
      { key: "pi", value: "3.14", isComplex: false },
    ]);
  });

  test("parses arrays as complex", () => {
    const entries = parseYamlEntries("tags:\n  - markdown\n  - test");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.key).toBe("tags");
    expect(entries[0]!.isComplex).toBe(true);
    expect(entries[0]!.value).toContain("markdown");
    expect(entries[0]!.value).toContain("test");
  });

  test("parses flow arrays as complex", () => {
    const entries = parseYamlEntries("tags: [a, b, c]");
    expect(entries[0]!.isComplex).toBe(true);
  });

  test("parses nested objects as complex", () => {
    const entries = parseYamlEntries("nested:\n  key: value\n  other: 123");
    expect(entries[0]!.key).toBe("nested");
    expect(entries[0]!.isComplex).toBe(true);
  });

  test("handles null values", () => {
    const entries = parseYamlEntries("empty: null\nalso_empty:");
    expect(entries[0]!.value).toBe("");
    expect(entries[1]!.value).toBe("");
  });

  test("returns empty array for empty string", () => {
    expect(parseYamlEntries("")).toEqual([]);
    expect(parseYamlEntries("   ")).toEqual([]);
  });

  test("returns empty array for non-object YAML", () => {
    expect(parseYamlEntries("just a string")).toEqual([]);
  });
});

describe("serializeYamlEntries", () => {
  test("serializes simple entries", () => {
    const yaml = serializeYamlEntries([
      { key: "title", value: "Hello", isComplex: false },
      { key: "draft", value: "false", isComplex: false },
    ]);
    expect(yaml).toContain("title: Hello");
    expect(yaml).toContain("draft: false");
  });

  test("skips entries with empty keys", () => {
    const yaml = serializeYamlEntries([
      { key: "", value: "orphan", isComplex: false },
      { key: "valid", value: "kept", isComplex: false },
    ]);
    expect(yaml).not.toContain("orphan");
    expect(yaml).toContain("valid: kept");
  });

  test("returns empty string for no valid entries", () => {
    expect(serializeYamlEntries([])).toBe("");
    expect(serializeYamlEntries([{ key: "", value: "x", isComplex: false }])).toBe("");
  });

  test("re-parses complex values", () => {
    const yaml = serializeYamlEntries([{ key: "tags", value: "- a\n- b", isComplex: true }]);
    expect(yaml).toContain("tags:");
    expect(yaml).toContain("- a");
    expect(yaml).toContain("- b");
  });

  test("handles invalid complex value gracefully", () => {
    const yaml = serializeYamlEntries([{ key: "bad", value: ": : :", isComplex: true }]);
    expect(yaml).toContain("bad:");
  });

  test("coerces scalar types", () => {
    const yaml = serializeYamlEntries([
      { key: "bool", value: "true", isComplex: false },
      { key: "num", value: "42", isComplex: false },
      { key: "str", value: "hello", isComplex: false },
    ]);
    expect(yaml).toContain("bool: true");
    expect(yaml).toContain("num: 42");
    expect(yaml).toContain("str: hello");
  });
});

describe("round-trip", () => {
  test("simple frontmatter round-trips", () => {
    const original = "title: Test\nauthor: Jane\ndraft: false";
    const entries = parseYamlEntries(original);
    const serialized = serializeYamlEntries(entries);
    const reparsed = parseYamlEntries(serialized);
    expect(reparsed).toEqual(entries);
  });
});
