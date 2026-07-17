const { handleCloudflare } = require('../utils/cloudflare');

/**
 * BasePage - Base class for all page objects
 * Contains common methods used by all page classes
 */
class BasePage {
  constructor(page) {
    this.page = page;
  }

  /**
   * Navigate to a URL. If Cloudflare serves a challenge, it is solved
   * automatically via 2Captcha before returning.
   *
   * Retries a few times on transient network errors (e.g. "The Internet
   * connection appears to be offline") so a momentary blip doesn't fail a test.
   */
  async navigateTo(url, { retries = 2, waitUntil = 'domcontentloaded', timeout = 30000 } = {}) {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Bound each attempt so a hang (this Shopify site's 'load' event is slow
        // due to marketing scripts) fails fast instead of eating the test budget.
        await this.page.goto(url, { waitUntil, timeout });
        await handleCloudflare(this.page);
        return;
      } catch (error) {
        lastError = error;
        const transient = /offline|net::ERR|ECONN|ETIMEDOUT|EAI_AGAIN|Timeout|Target page.*closed|frame was detached/i.test(
          error.message || ''
        );
        // Stop retrying if the error isn't transient, we're out of attempts, or
        // the page/context is already closing (retrying then would just hang).
        if (!transient || attempt === retries || this.page.isClosed()) throw error;
        // eslint-disable-next-line no-console
        console.log(`[navigateTo] transient error (attempt ${attempt}/${retries}): ${(error.message || '').split('\n')[0]} — retrying...`);
        await this.page.waitForTimeout(1500);
      }
    }
    throw lastError;
  }

  /**
   * Click on an element
   */
  async click(selector) {
    await this.page.click(selector);
  }

  /**
   * Fill text in an input field
   */
  async fill(selector, text) {
    await this.page.fill(selector, text);
  }

  /**
   * Get text from an element
   */
  async getText(selector) {
    return await this.page.textContent(selector);
  }

  /**
   * Wait for an element to be visible
   */
  async waitForElement(selector, timeout = 5000) {
    await this.page.waitForSelector(selector, { timeout, state: 'visible' });
  }

  /**
   * Check if element is visible
   */
  async isVisible(selector) {
    return await this.page.isVisible(selector);
  }

  /**
   * Get all elements matching selector
   */
  async getElements(selector) {
    return await this.page.locator(selector).all();
  }

  /**
   * Count elements matching selector
   */
  async getElementCount(selector) {
    return await this.page.locator(selector).count();
  }

  /**
   * Wait for page to load
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get element attribute value
   */
  async getAttribute(selector, attribute) {
    return await this.page.getAttribute(selector, attribute);
  }
}

module.exports = BasePage;