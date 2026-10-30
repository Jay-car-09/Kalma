# Before beta (Phase 4)

Things to settle before testers get the app. Tick each one off or turn it into a task.

## 1. Check on a real phone

App lock (Phase 1F):
- [ ] **iPhone, sheet open:** turn on App lock with "Immediately". Open Mark paid, go to the home screen, come back. The lock screen should cover the sheet, and the app switcher should show only the Kalma cover. Unlock, and the sheet is still there with what you typed.
- [ ] **Android, app switcher:** with App lock on, open Kalma and then the recent-apps view. The Kalma card should show only the cover, not your amounts. If amounts show, see 2a.
- [ ] **Return to a locked app:** cancel the unlock prompt, leave the app, then come back. The prompt should appear again by itself.
- [ ] **iPhone Face ID:** in your own build (Phase 3), the prompt should use Face ID, not only the passcode.

Accounts (Phase 2C):
- [ ] **Security self-test** (Account → Developer) shows PASS against the project testers will use, and step 4 says "unchanged".
- [ ] **Supabase → Authentication → Email:** code expiry is 10 minutes (600 seconds). The app tells "wrong code" from "expired code" using that time.

## 2. Decisions for the owner

a. **Android app-switcher cover.** If the check in 1 shows amounts, the reliable fix is Android's "secure screen" flag. It needs a new library, `expo-screen-capture`, which you would have to add to CLAUDE.md section 9. Side effect: nobody can take screenshots of Kalma while App lock is on.

b. **Android, "Immediately", and sharing.** Opening the share sheet counts as leaving the app on Android, so after an export you unlock again. Recommendation: keep this. Skipping it would also skip the lock if you went from the share sheet into another app and came back much later.

c. Open questions from earlier phases:
- Undoing a payment brings the tracker back. Should it also turn its reminders back on?
- Editing a payment's amount: should Kalma check again whether a one-time tracker is still Done?
- "Every N months" repeats can drift from the original day (e.g. the 31st becomes the 28th, then stays there). Is that acceptable?
- Unarchiving always makes a tracker Active, even if it was Done.
- The dashboard's "paid" total includes Done trackers.
- Insight cards with no data are hidden rather than shown empty.
- The limit prompts have no Upgrade button until purchases exist (Phase 3).

## 3. Wording

- [ ] The owner reviews all Tagalog text (`src/i18n/locales/tl.json`).
- [ ] The Face ID permission text in `app.json` is English only. Decide whether it needs Tagalog for the store builds.

## 4. Known Expo Go limits (go away in our own builds)

- Android reminders use the default notification channel in Expo Go (the channel setup fails there).
- iPhone Expo Go may offer the passcode instead of Face ID.
