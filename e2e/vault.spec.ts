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

test("blocks sign-in before pre-login when a required capability disappears", async ({
  page,
}) => {
  let preloginCalls = 0;
  await page.route("**/api/v1/auth/prelogin", async (route) => {
    preloginCalls += 1;
    await route.abort();
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(window, "WebAssembly", {
      value: undefined,
      configurable: true,
    });
  });
  await page.getByLabel("Email").fill("demo@example.com");
  await page.getByLabel("Master password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Unlock vault" }).click();
  await expect(
    page.getByRole("heading", { name: "Browser not supported" }),
  ).toBeVisible();
  await expect(
    page.getByText("WebAssembly compilation and memory"),
  ).toBeVisible();
  expect(preloginCalls).toBe(0);
});

test("blocks account creation before pre-login when a required capability is missing", async ({
  page,
}) => {
  let preloginCalls = 0;
  await page.route("**/api/v1/auth/prelogin", async (route) => {
    preloginCalls += 1;
    await route.abort();
  });
  await page.addInitScript(() => {
    Object.defineProperty(window, "WebAssembly", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Browser not supported" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create account" }),
  ).toHaveCount(0);
  expect(preloginCalls).toBe(0);
});

test("blocks vault unlock before key derivation when WebAssembly disappears", async ({
  page,
}) => {
  const email = `e2e-preflight-${Date.now()}@example.com`;
  await page.goto("/");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Email").fill(email);
  await page
    .getByLabel("Master password", { exact: true })
    .fill("correct horse battery staple");
  await page
    .getByLabel("Confirm master password")
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Create encrypted vault" }).click();
  await expect(
    page.getByRole("heading", { name: "Your vault", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lock" }).click();
  await page.evaluate(() => {
    Object.defineProperty(window, "WebAssembly", {
      value: undefined,
      configurable: true,
    });
  });
  await page.getByLabel("Master password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Browser not supported" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your vault", exact: true }),
  ).toHaveCount(0);
});
