class CookieManager {
    /**
     * Sets a cookie.
     * @param {string} name - The name of the cookie.
     * @param {string} value - The value of the cookie.
     * @param {Object} [options={}] - Optional settings for the cookie.
     * @param {number} [options.days] - Expiration time in days.
     * @param {string} [options.path] - Path for the cookie.
     * @param {string} [options.domain] - Domain for the cookie.
     * @param {boolean} [options.secure] - Whether the cookie is secure.
     */
    static set(name, value, options = {}) {
      let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  
      if (options.days) {
        const date = new Date();
        date.setTime(date.getTime() + options.days * 24 * 60 * 60 * 1000);
        cookieString += `; expires=${date.toUTCString()}`;
      }
  
      if (options.path) {
        cookieString += `; path=${options.path}`;
      }
  
      if (options.domain) {
        cookieString += `; domain=${options.domain}`;
      }
  
      if (options.secure) {
        cookieString += `; secure`;
      }
  
      document.cookie = cookieString;
    }
  
    /**
     * Gets the value of a cookie.
     * @param {string} name - The name of the cookie to retrieve.
     * @returns {string|null} - The value of the cookie, or null if not found.
     */
    static get(name) {
      const cookies = document.cookie.split('; ');
      for (const cookie of cookies) {
        const [key, value] = cookie.split('=');
        if (decodeURIComponent(key) === name) {
          return decodeURIComponent(value);
        }
      }
      return null;
    }
  
    /**
     * Deletes a cookie.
     * @param {string} name - The name of the cookie to delete.
     * @param {Object} [options={}] - Optional settings for the cookie.
     * @param {string} [options.path] - Path for the cookie.
     * @param {string} [options.domain] - Domain for the cookie.
     */
    static delete(name, options = {}) {
      this.set(name, '', { ...options, days: -1 });
    }
  }

  export default CookieManager;