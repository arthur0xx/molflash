async function main() {
  const rawBaseUrl = process.argv[2] || process.env.CHRIGSM_URL;

  if (!rawBaseUrl) {
    console.error("استخدم: npm run check:release -- https://your-deployment.vercel.app");
    process.exit(2);
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(rawBaseUrl);
    if (baseUrl.protocol !== "https:") throw new Error("insecure protocol");
  } catch {
    console.error("يجب أن يكون رابط الفحص HTTPS صالحًا.");
    process.exit(2);
  }

  baseUrl.pathname = baseUrl.pathname.replace(/\/$/, "");
  const checks = [
    { path: "/", expectedStatus: 200, text: "ChriGsm" },
    { path: "/catalog", expectedStatus: 200, text: "كل الخدمات" },
    { path: "/robots.txt", expectedStatus: 200, text: "Sitemap:" },
    { path: "/sitemap.xml", expectedStatus: 200, text: "<urlset" },
    { path: "/admin", expectedStatus: 200, text: "ChriGsm" },
  ] as const;

  let failed = false;
  for (const check of checks) {
    const url = new URL(check.path, baseUrl).toString();
    try {
      const response = await fetch(url, { redirect: "manual", headers: { "user-agent": "ChriGsm-release-check/1.0" } });
      const body = await response.text();
      const passed = response.status === check.expectedStatus && body.includes(check.text);
      console.log(`${passed ? "PASS" : "FAIL"} ${check.path} — HTTP ${response.status}`);
      if (!passed) failed = true;
    } catch (error) {
      console.log(`FAIL ${check.path} — ${error instanceof Error ? error.message : "network error"}`);
      failed = true;
    }
  }

  try {
    const apiUrl = new URL("/api/admin/snapshot", baseUrl).toString();
    const response = await fetch(apiUrl, { redirect: "manual", headers: { "user-agent": "ChriGsm-release-check/1.0" } });
    // Vercel can return 302 for an access-protected preview before the application returns its 403 response.
    const passed = response.status === 403 || response.status === 302;
    console.log(`${passed ? "PASS" : "FAIL"} /api/admin/snapshot guest guard — HTTP ${response.status}`);
    if (!passed) failed = true;
  } catch (error) {
    console.log(`FAIL /api/admin/snapshot guest guard — ${error instanceof Error ? error.message : "network error"}`);
    failed = true;
  }

  if (failed) process.exit(1);
  console.log("تم اجتياز فحص الإصدار العام وحاجز CMC للزائر.");
}

void main();
