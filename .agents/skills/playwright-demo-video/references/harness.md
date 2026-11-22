# Harness pattern (framework-neutral)

Copy the *shape*, not the project's selectors. Types/imports are from
`@playwright/test` and `node:*`. The two helper modules are described here; the
spec itself contains only the storyboard.

## Config

```ts
// playwright.video.config.ts
export default defineConfig({
    testDir: './tests/video',
    outputDir: 'test-results/demo-video',
    fullyParallel: false,
    workers: 1,
    use: {
        baseURL: 'http://localhost:<dev-port>',
        locale: 'de-DE',
        viewport: { width: 1280, height: 720 },
        video: 'off',           // only the recording context opts in
        trace: 'off',
    },
    projects: [{ name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } }],
});
```

The E2E and screenshot configs must keep `video: 'off'` and their own `testDir`.

## Recording + boot trim (harness.ts)

```ts
export interface DemoRecording {
    page: Page;                              // already logged in and booted
    finish: (published: boolean) => Promise<void>;
}

export async function record(
    browser: Browser, testInfo: TestInfo, email: string, password: string,
    waitUntilReady: (page: Page) => Promise<void>,
): Promise<DemoRecording> {
    const rawDir = path.join(testInfo.outputDir, 'raw');
    const target = path.resolve('public/demo-videos',
        `${path.basename(testInfo.file, '.spec.ts')}.webm`);
    await fs.mkdir(rawDir, { recursive: true });
    let context: BrowserContext | undefined;
    const discard = async () => {
        await context?.close().catch(() => undefined);
        await rmIfExists(rawDir);
        await rmIfExists(target);
    };
    try {
        // 1. Login outside the recording.
        const login = await browser.newContext({ baseURL: BASE_URL, locale: 'de-DE' });
        const loginPage = await login.newPage();
        await loginAs(loginPage, email, password);
        const cookies = await login.cookies();
        await login.close();

        // 2. Boot inside the recording, but measure it for trimming.
        const startedAt = Date.now();
        context = await browser.newContext({
            baseURL: BASE_URL, locale: 'de-DE',
            storageState: { cookies, origins: [] },
            recordVideo: { dir: rawDir, size: VIEWPORT },
        });
        const page = await context.newPage();
        const video = page.video();
        if (!video) throw new Error('Video recording could not be started');
        await page.goto('/');
        await waitUntilReady(page);          // loader gone, main visible, no skeletons
        const bootSeconds = (Date.now() - startedAt) / 1000 + 0.3;

        const activeContext = context;
        return {
            page,
            finish: async (published) => {
                await activeContext.close().catch(() => undefined);
                if (!published) return discard();
                const raw = await video.path();
                execFileSync(ffmpegBinary(), [
                    '-hide_banner', '-loglevel', 'error', '-y',
                    '-ss', bootSeconds.toFixed(3), '-i', raw,
                    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-an', target,
                ], { stdio: 'inherit' });
            },
        };
    } catch (error) {
        await discard();
        throw error;
    }
}
```

`ffmpegBinary()` checks `$FFMPEG_PATH`, then `execFileSync('ffmpeg', ['-version'])`,
then `~/.cache/ms-playwright/ffmpeg-*/ffmpeg-<platform>` (or
`$PLAYWRIGHT_BROWSERS_PATH`). `rmIfExists()` calls `fs.rm(path, { recursive: true })`
and ignores `ENOENT` — do not use `{ force: true }` if the project's lint rule
forbids it outside Playwright actions.

## Real-image assertion

```ts
export async function expectRealImage(page: Page, locator: Locator, what: string) {
    await expect(locator, `${what} is not visible`).toBeVisible({ timeout: 20000 });
    await expect(async () => {
        await locator.scrollIntoViewIfNeeded();
    }).toPass({ timeout: 15000 });           // SWR may replace the <img> node
    const src = await locator.getAttribute('src') ?? '';
    let diagnostic = `src=${src}`;
    try {
        const r = await page.request.get(src, { timeout: 10000 });
        diagnostic += ` http=${r.status()} body=${(await r.text()).slice(0, 200)}`;
    } catch (error) { diagnostic += ` request-error=${String(error)}`; }
    await expect.poll(() => locator.evaluate(el => (el as HTMLImageElement).complete),
        { timeout: 20000, message: `${what}: image not loaded — ${diagnostic}` }).toBe(true);
    await expect.poll(() => locator.evaluate(el => (el as HTMLImageElement).naturalWidth),
        { timeout: 20000, message: `${what}: broken image — ${diagnostic}` }).toBeGreaterThan(0);
}
```

## Spec skeleton

```ts
test('Demo-Video: <what the viewer sees, in one line>',
     { tag: ['@demo-video', '@feature:<name>'] }, async ({ browser, request }, testInfo) => {
    const helper = new E2ESessionHelper(request);
    const user = await helper.createIsolatedUser('photographer');
    let recording: DemoRecording | undefined;
    let published = false;
    try {
        recording = await record(browser, testInfo, user.email, user.password, waitUntilReady);
        const page = recording.page;
        // ...storyboard with beat(page), pressSequentially(delay), explicit holds...
        await recording.finish(true);
        published = true;
    } finally {
        if (recording && !published) await recording.finish(false);
        await helper.teardown();
    }
});
```

## Gates that must stay green

```sh
pnpm exec tsc -p tsconfig.tests.json --noEmit --pretty false
pnpm lint:e2e          # add tests/video to this script and the ESLint override
pnpm lint && pnpm build
npx playwright test -c playwright.video.config.ts --reporter=list
```

If the project's ESLint config globally ignores its test directories, add the
video directory to the `--no-ignore` lint script **and** to a matching
`files: ['tests/video/**/*.ts']` override, otherwise the new category silently
escapes CI lint.
