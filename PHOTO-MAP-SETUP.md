# Runner's Rings community map photos — setup

This bundle adds a collapsible photo panel and photo layer to the existing index map. The panel starts collapsed, and the layer starts OFF. Photo submissions require sign-in and remain private until the designated account approves them.

The photo's public author name is copied from the separately saved account setting `photo_public_name` when submitted. This is independent of the account's ordinary `display_name`. A blank photo public name is shown as 「ランナー」. The send confirmation shows the public name and exact capture GPS coordinates before upload. Changing the photo public name later affects future submissions; an existing photo keeps the name saved with that submission. Contributors who do not want to publish a name should leave the photo public name blank. The `author_display_name` column in `map_photos` stores the submission-time snapshot; no additional SQL change is needed for this setting.

## Included files

- `index.html`: full replacement for the current root `index.html`.
- `photo-map-setup.sql`: one-time Supabase schema, private Storage bucket, grants, and RLS policies.
- `ROADMAP.md`: current roadmap with confirmed October 8 completion states and this feature tracked as pending manual setup/review.
- `PHOTO-MAP-SETUP.md`: these deployment steps.

## Before publishing the HTML

1. Verify that the Supabase account currently used for the site's admin shortcuts is still user ID `386da875-298e-46b7-927d-0e02d02c409a`. The existing `index.html` uses this exact ID for its Journal admin shortcut. The SQL limits photo decisions to that account.
2. In Supabase SQL Editor, run `photo-map-setup.sql`. This is a production schema change; do not run it against a different project.
3. Confirm the private bucket `map-photos-private` has public access disabled and that the policies from the SQL are present.
4. Replace the site's root `index.html` with the bundled full replacement.
5. Sign in with a non-reviewer test account and submit a harmless test image. Verify the pending record is invisible to a signed-out visitor and its image URL cannot be fetched.
6. Sign in as the designated reviewer. Open the index map's review queue, share the pending photo with Chappy for a checklist review, and approve only after the review and final decision. Rejected images are deleted from Storage.
7. Turn the photo layer ON from a signed-out browser and verify only approved images appear. Confirm the layer is OFF after a fresh page load.

## Publication checklist

Use the same stated checklist for every submission. Reject an image showing people or faces (including children), cars or other vehicles, a license plate, personal/contact information, or an identifiable home/work/private location. Publish only images suitable for a public running map, with the submitter's explicit consent and a location they intend to share. Review the saved public author name and caption with each image. This is a human review workflow; the app does not claim that AI automatically detects or approves content. The operator reviews each image with Chappy against the checklist; the account holder makes the final decision in the app.

Before publishing, update the live root `index.html` with the corrected full replacement in this bundle. The page uses the photo's embedded capture-time GPS for the map pin; it does not use the phone's location at upload time. A photo without readable capture-time GPS is rejected with a message asking the contributor to enable camera location and retake it. Before upload, the browser re-encodes accepted JPEG/PNG/WebP files to JPEG, removing GPS and other metadata from the public image file. The database keeps only the pin coordinates. The submission confirmation displays those coordinates and states that the exact location will be public on the map after approval. Contributors should avoid homes, workplaces, and other sensitive places. Approved photos are served with expiring signed URLs from a private bucket; the bucket itself is never public.

## Rollback

Turn off/remove the new panel by restoring the previous `index.html`. To remove the backend later, first export or delete `public.map_photos` records and the `map-photos-private` bucket after confirming there are no photos to retain. Do not drop objects as part of routine rollback.
