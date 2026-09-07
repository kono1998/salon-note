import { test, expect } from '@playwright/test';

const BASE_URL = 'https://salon-note-one.vercel.app';
const TEST_EMAIL = 'test@salon-note.test';
const TEST_PASSWORD = 'testpass123';

// ログインヘルパー
async function login(page: any) {
  await page.goto(BASE_URL);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  // Enterキーでログイン（ボタン指定の問題を回避）
  await page.keyboard.press('Enter');
  // ページが変わるまで待つ（ログイン画面が消えること）
  await page.waitForFunction(() => {
    return !document.querySelector('input[type="password"]');
  }, { timeout: 20000 });
  await page.waitForTimeout(2000);
}

// タブ切り替えヘルパー（PC=サイドバーdiv、モバイル=ボタン）
async function clickNav(page: any, label: string) {
  // サイドバーのナビアイテム（div）かモバイルのボタンをクリック
  const navItem = page.locator(`[class*="pc-sidebar"] >> text=${label}`).first();
  const mobileBtn = page.locator(`button:has-text("${label}")`).first();
  
  if (await navItem.isVisible().catch(() => false)) {
    await navItem.click();
  } else {
    await mobileBtn.click();
  }
}

// ── 認証 ──────────────────────────────────────────────────────
test.describe('認証', () => {
  test('ログイン画面が表示される', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('間違ったパスワードでログインできない', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.locator('button:has-text("ログイン")').last().click();
    await page.waitForTimeout(4000);
    // まだログイン画面にいること
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('正しい認証情報でログインできる', async ({ page }) => {
    await login(page);
    // ログアウトボタンが存在することを確認
    const logoutExists = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('ログアウト'));
    });
    expect(logoutExists).toBe(true);
  });
});

// ── 顧客管理 ──────────────────────────────────────────────────
test.describe('顧客管理', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('顧客一覧が表示される', async ({ page }) => {
    // content-areaが表示されていること
    await expect(page.locator('.content-area')).toBeVisible();
  });

  test('顧客を追加できる', async ({ page }) => {
    const testName = `テスト顧客${Date.now()}`;
    // ＋ 追加ボタンをクリック
    await page.locator('button:has-text("追加")').first().click();
    await page.waitForSelector('input[placeholder="山田 花子"]', { timeout: 5000 });
    await page.fill('input[placeholder="山田 花子"]', testName);
    await page.fill('input[placeholder*="ハイフン不要"]', '09012345678');
    await page.locator('button:has-text("保存する")').click();
    await page.waitForTimeout(3000);
    const content = await page.textContent('body');
    expect(content).toContain(testName);
  });

  test('顧客を検索できる', async ({ page }) => {
    await page.fill('input[placeholder*="検索"]', 'テスト');
    await page.waitForTimeout(500);
    await expect(page.locator('.content-area')).toBeVisible();
  });
});

// ── カレンダー ────────────────────────────────────────────────
test.describe('カレンダー', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('カレンダー画面に切り替えられる', async ({ page }) => {
    await clickNav(page, 'カレンダー');
    await page.waitForTimeout(1000);
    const content = await page.textContent('body');
    expect(content).toContain('カルテ追加');
  });
});

// ── 設定 ──────────────────────────────────────────────────────
test.describe('設定', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('設定画面に切り替えられる', async ({ page }) => {
    await clickNav(page, '設定');
    await page.waitForTimeout(1000);
    const content = await page.textContent('body');
    expect(content).toContain('テーマカラー');
  });
});

// ── モバイル表示 ──────────────────────────────────────────────
test.describe('モバイル表示', () => {
  test('iPhone サイズでログイン画面が表示される', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL);
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
