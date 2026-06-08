import asyncio
from playwright import async_api
from playwright.async_api import expect
from _base_url import bind_base_url

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)

        # Open a new page in the browser context
        page = bind_base_url(await context.new_page())

        # Interact with the page elements to simulate user flow
        # -> Navigate to http://localhost:3001/auth
        await page.goto("http://localhost:3001/auth", wait_until="commit", timeout=10000)
        
        # -> Fill the email and password fields with admin@admin.com / admin123 and submit the sign-in form to log in.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=/html/body/div[2]/div/div[2]/div[2]/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('admin@admin.com')
        
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=/html/body/div[2]/div/div[2]/div[2]/div[2]/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('admin123')
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div/div[2]/div[2]/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Click the 'Pengaturan' (Settings) link to open the store profile settings page.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div/aside/nav/a[6]').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Navigate directly to the settings page (/pengaturan) so the store profile fields can be edited.
        await page.goto("http://127.0.0.1:3001/pengaturan", wait_until="commit", timeout=10000)
        
        # -> Fill the email and password fields with admin@admin.com and admin123, then submit the sign-in form to authenticate.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=/html/body/div[2]/div/div[2]/div[2]/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('admin@admin.com')
        
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=/html/body/div[2]/div/div[2]/div[2]/div[2]/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('admin123')
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div/div[2]/div[2]/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Click the 'Masuk ke dashboard' button to submit the sign-in form and wait for the dashboard to load (index 1257).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div/div[2]/div[2]/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Click the 'Masuk ke dashboard' button to sign in and wait for the dashboard to load.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div/div[2]/div[2]/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Click the 'Masuk ke dashboard' button to sign in, then wait for the dashboard to load.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div/div[2]/div[2]/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # -> Fill email and password on the sign-in form and click the 'Masuk ke dashboard' button (index 1464) to sign in, then wait for the dashboard to load.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=/html/body/div[2]/div/div[2]/div[2]/div[2]/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('admin@admin.com')
        
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=/html/body/div[2]/div/div[2]/div[2]/div[2]/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('admin123')
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div[2]/div/div[2]/div[2]/div[2]/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        
        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=Unique Store Name TC001').first).to_be_visible(timeout=3000)
        await expect(frame.locator('text=Owner TC001').first).to_be_visible(timeout=3000)
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    
