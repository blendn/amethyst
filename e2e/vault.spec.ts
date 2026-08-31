import { expect, test } from "@playwright/test";

test("creates an encrypted vault and unlocks it after reload", async ({
  page,
}) => {
  const email = `e2e-${Date.now()}@example.com`;
  const masterPassword = "correct horse battery staple";

  await page.goto("/");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Email").fill(email);
  await page
    .getByLabel("Master password", { exact: true })
    .fill(masterPassword);
  await page.getByLabel("Confirm master password").fill(masterPassword);
  await page.getByRole("button", { name: "Create encrypted vault" }).click();

  await expect(
    page.getByRole("heading", { name: "Your vault", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New entry" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Example account");
  await page.getByLabel("Username", { exact: true }).fill("demo@example.com");
  await page.getByLabel("Website", { exact: true }).fill("https://example.com");
  await page.locator(".password-field input").fill("example-password");
  await page.getByRole("button", { name: "Encrypt & save" }).click();

  const entry = page.locator("article.entry");
  await expect(entry).toContainText("Example account");
  await expect(entry).toContainText("demo@example.com");

  await page.getByRole("button", { name: "Lock" }).click();
  await expect(
    page.getByRole("heading", { name: "Vault locked" }),
  ).toBeVisible();
  await page.getByLabel("Master password").fill(masterPassword);
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(entry).toContainText("Example account");

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Vault locked" }),
  ).toBeVisible();
  await page.getByLabel("Master password").fill(masterPassword);
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(entry).toContainText("Example account");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
