import { test as setup } from "@playwright/test";
import { DEMO_EMAIL, DEMO_STATE, logIn } from "./login";

// One sign-in for all scenarios: Better Auth allows 5 login links a minute,
// and the scenarios run against a production build where that limit is on.
setup("sign in as the demo account", async ({ page }) => {
  await logIn(page, DEMO_EMAIL);
  await page.context().storageState({ path: DEMO_STATE });
});
