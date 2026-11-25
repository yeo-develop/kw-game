module.exports = async function advanceOpening(page, targetStep = 5) {
  while (await page.evaluate(target => (window.game.state.raw?.opening?.step ?? 5) < target, targetStep)) {
    await page.evaluate(() => {
      if (new URLSearchParams(location.search).get('manual') === '1' && window.game.state.guard) {
        window.game.step(window.game.state.guard);
      }
    });
    await page.waitForFunction(() => window.game.state.guard === 0);
    const next = page.locator('#veil .intro [data-do="ok"]');
    if (await next.isDisabled()) await page.locator('#veil [data-do="dream"]').first().click();
    await next.click();
  }
};
