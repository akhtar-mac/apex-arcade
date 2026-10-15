# Fix plan after the 13 Oct 2026 browser pass

Checked in the browser on this laptop: landing `:5173`, player `:5174`, admin `:5175`, P2P `:5176`, API `:4000`.

What already works: player login on `localhost`, live wallet balance, a withdrawal hold, a reject that refunds, an empty QR list, the live player list, and the live settlement queue. A payout cannot be marked paid until a 12-digit UTR is typed.

A test deposit UTR `123456789012` and a ₹500 withdrawal on `9876543210` were created during this pass and then rejected. That wallet is back to ₹5,400 with ₹0 locked.

## Phase A — Money must match the ledger

1. Player bets never reach the server. The arena sends `round-${roundNumber}`. The engine’s round id is a UUID from `round:sync`. The server rejects the bet. The screen still subtracts the chip. Use the `roundId` from `round:sync`, wait for `bet:confirmed` or the error callback, and only then change the balance.
2. `POST /payments/submit-utr` accepts a UTR when no QR is published and no deposit intent exists. Require a live QR and a deposit intent first. Show the error on the UTR form.
3. P2P deposit approve removes the row and adds the amount to “Verified Today” even when the API fails. Read `res.ok` before changing the screen. Do the same for deposit reject.
4. The player starts at ₹5,000 in memory (`useState(5000)`) before `/auth/me` returns. Start at ₹0.
5. Show locked funds next to the playable balance. A withdrawal hold is real, and the profile never says money is waiting on the desk.

## Phase B — Take the invented players off the arena

1. Delete the hardcoded live bet list (`UID_7482` and the rest) and the timer that invents more bets while a round is open.
2. Delete the “LIVE • 10,000 CCU” label.
3. Lobby: remove the ₹2,45,890 jackpot, the 679 / 428 / 184 / 67 player counts, and the fake winners ticker.
4. Last draws still start at rounds `#1404` and `#1403`. Show only rounds the engine has settled.
5. Profile stats are painted on: UID `APX-98214`, 38.4% win rate, 142 bets, highest win ₹5,000, and `player@okaxis` marked verified. Use the real user id, real bet count, and the UPI saved on the account. This user has no UPI on file.
6. Login still says “1-Click Instant Demo Login (₹5,000 Free)” and registration says “Claim ₹5,000”. The register API starts the wallet at ₹0. Remove the bonus copy. If OTP send fails, do not pretend the code was sent and do not open the arena.
7. The support chat is a script. It tells people withdrawals under ₹2,000 go out by IMPS in 60 seconds, and it invents officer Pooja, WhatsApp `9876543210`, and Telegram. Replace it with the real desk steps, or remove the chat.

## Phase C — Admin and P2P must not invent the business

1. Admin overview is painted: ₹4,82,400 volume, ₹1,46,650 profit, 679 players, 3 active QRs, rounds `#1404`–`#1402` with “Lowest Liability”, and “exactly 30% retention”. The QR tab itself says 0 accounts. Drive this from settled rounds and the QR table, or show an empty report.
2. The Round report screen still offers a 30% margin slider, Lowest Liability, and Manual Force Card. The Live Arena tab shows a fake pool of ₹40,575 and “Draw in 15s” while the real clock is on a later round. Risk Ops still has a Force Win button on every card, and `POST /admin/kill-switches/force-settle-card` can still pick the card. Remove those controls. The card is sealed when the round starts.
3. Kill-switch copy still says automated IMPS and auto-dispatch under ₹2,000. The header still says “10,000 CCU” and “PgBouncer 5000:50”. The mobile tab is still labelled “30% Margin”.
4. P2P header is Agent Vikram, AGT-4402, ₹485K verified, ₹340K dispatched, 84s average. Those numbers are the initial state, not the ledger.
5. The deposit proof panel always shows a green “Matches Bank Statement Timestamp”, even with no screenshot and no bank file. Show the screenshot only when one was uploaded. Otherwise say there is no proof.
6. Approving a deposit in the UI adds to the fake verified total before the API confirms.
7. Shift log stays empty after a reject. Deposit reject does not write a log line.
8. Player label becomes `Player #-001` because the old id is `demo-user-001`.
9. Settings still has `apex.fastpay@okaxis`, a webhook secret box, and “gateway endpoints”. Saving does not change the live QR. Either wire it to the QR table or remove it.
10. `+₹500` on a player is a manual credit. Confirm it writes the ledger with an admin id, or remove it until it does.

## Phase D — Landing and login copy

The landing page still contradicts the desk. Change these lines so they match manual UPI and a sealed card:

- Top banner: “WELCOME BONUS — ₹500 instant play balance”.
- Hero: automated instant UPI, sub-3-minute withdrawals, 100% provably fair.
- Stat: Auto-Withdrawal under 90 seconds.
- “Engine computes 20–30% optimized winning outcome.”
- “Never wait for a banking agent” and “automated liquidity protocol”.
- “99.98% uptime” and “Enterprise cluster Mumbai-01”.
- “Join 10,000+ players. Your first ₹500 is on us.”
- Download steps: “claim ₹500 bonus”.
- The APK at `/downloads/apex-arcade-v2.4.0.apk` is a 52-byte file, not an 18.5 MB app. Point the button at the web app until a real signed APK exists.
- Player login says 60-second rounds and “instant bank payouts”. Rooms are 120 / 180 / 240 seconds. Footer says “RBI & FIU Compliant Gateway”.
- Deposit modal badge says INSTANT. Withdrawal title says “Instant UPI Payout” and the button says “Processing Payout” while the row is only pending.

## Phase E — Compliance that the screen pretends to save

1. Responsible Gaming “Close & Save” only closes the modal. Daily cap and 24h / 7d / 30d breaks never call `POST /api/v1/auth/compliance`.
2. Self-exclusion sends the person to the fake support chat.
3. A UTR can be submitted for an old account that never confirmed age. Enforce the age and daily-cap checks on `submit-utr`, not only on the deposit intent.
4. CORS allows `http://localhost:5173`–`5176` and not `http://127.0.0.1` on those ports. Opening the player on `127.0.0.1:5174` fails the API call, and the login screen then behaves as if a demo OTP was sent.

## Phase F — Small defects

1. The arena clock is always `00:` plus the raw seconds, so 103 seconds renders as `00:103`. Show minutes and seconds.
2. Old rows are still in Postgres from before the ledger cut: admin `9999999999` at ₹1,00,000, `9876543210` at ₹5,400, plus `9988776655` and `9000011122`. New signups start at ₹0. Decide whether those old balances stay.
3. Admin display name is still “Apex Player” with UPI `apexadmin@bank`.
4. Profile links to WhatsApp and Telegram that are not a real desk.
5. The clock comment in `placeBet` still says the engine optimizes the card in the last 10 seconds. The card is already sealed. Update the comment so the next person does not restore the profit lock.

## Order

Do A first. A wrong bet or a UTR with no QR is the launch blocker. Then B and C, because the screens currently show a different business from the one the API runs. D and E before any public link. F can ride along with the screen it belongs to.
