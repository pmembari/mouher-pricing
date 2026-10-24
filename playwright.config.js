const { defineConfig, devices } = require('@playwright/test');
module.exports = defineConfig({
 testDir: './tests',
 timeout: 20000,
 expect: { timeout: 5000 },
 fullyParallel: true,
 workers: process.env.CI ? 2 : undefined,
 reporter: process.env.CI ? [['list'],['html',{open:'never'}]] : 'list',
 use: { baseURL: 'http://127.0.0.1:8765', serviceWorkers: 'block', trace: 'retain-on-failure' },
 projects: [
  {name:'chromium',use:{...devices['Desktop Chrome']}},
  {name:'mobile-webkit',use:{...devices['iPhone 13']}}
 ],
 webServer: {command:'python3 -m http.server 8765 --bind 127.0.0.1',url:'http://127.0.0.1:8765',reuseExistingServer:!process.env.CI,timeout:10000}
});
