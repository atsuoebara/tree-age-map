# Journal 2.0 finishing patch (2026-09-27)

## Included
- index.html: owner-only Journal shortcut inside account settings. Existing journal-admin.html still verifies the admin user and Supabase permissions; hiding a link is not security.
- journal-post.html, journal-v2-preview.html: include the permalink in share text for mobile apps that drop the separate URL field.
- scripts/generate-journal.mjs: same behavior for future published static pages.
- generate-journal.mjs: secondary generator share behavior aligned.
- journal/articles/.../index.html: already-published pages updated when their native-share code matches.
- assets/characters/atsuo-chappy-reference.jpeg: original user-provided canonical character reference. Do not modify this master.

## Still to test on iPhone
1. Admin account settings displays Journal管理; ordinary users do not. Confirm admin screen still checks actual authorization.
2. Open a published static article and share to Threads. Verify both article title and exact individual permalink are present before posting.
3. Journal admin draft/preview/publish end-to-end and generated page deploy.
4. Character artwork: use the reference file for future panels; no automatic AI character consistency is guaranteed.

Deploy only after reviewing diffs and preserving any intervening production changes.
