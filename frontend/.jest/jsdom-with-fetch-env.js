/**
 * Custom Jest environment that extends jsdom and exposes Node's native fetch
 * on global so that jest.spyOn(global, 'fetch') works.
 *
 * Node 18+ has fetch built in; jest-environment-jsdom does not forward it into
 * the sandbox. This environment copies it in during setup().
 */
const {TestEnvironment} = require('jest-environment-jsdom');

class JsdomWithFetchEnvironment extends TestEnvironment {
    async setup() {
        await super.setup();
        // Expose Node's native fetch inside the jsdom sandbox
        if (typeof fetch !== 'undefined') {
            this.global.fetch = fetch;
        }
        // Expose TextEncoder/TextDecoder (Node globals not forwarded by jsdom)
        if (typeof TextEncoder !== 'undefined') {
            this.global.TextEncoder = TextEncoder;
        }
        if (typeof TextDecoder !== 'undefined') {
            this.global.TextDecoder = TextDecoder;
        }
    }
}

module.exports = JsdomWithFetchEnvironment;
