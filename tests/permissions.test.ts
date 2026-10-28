import assert from "node:assert/strict";
import test from "node:test";
import { roles } from "../src/server/auth";
import type { Role } from "../src/lib/types";

const matrix: { role: Role; edit: boolean; manage: boolean; remove: boolean }[] = [
  { role: "owner", edit: true, manage: true, remove: true },
  { role: "admin", edit: true, manage: true, remove: true },
  { role: "agent", edit: true, manage: false, remove: false },
  { role: "viewer", edit: false, manage: false, remove: false },
];

for (const row of matrix) {
  test(`role ${row.role} permission matrix`, () => {
    assert.equal(roles.canEdit(row.role), row.edit);
    assert.equal(roles.canManageOrg(row.role), row.manage);
    assert.equal(roles.canDelete(row.role), row.remove);
  });
}

test("viewers can never be treated as editors", () => {
  assert.equal(roles.canEdit("viewer"), false);
});
