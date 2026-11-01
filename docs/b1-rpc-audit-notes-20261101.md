# B-1 RPC audit notes
Read-only inspection on 2026-11-01 found public.get_import_share_origin_page filters deleted_at IS NULL, paginates by run ID (up to 500), and has no year or consent filter. Source: database catalog inspection. Independent verification of full function definition remains required. No user records included. General publication stays OFF.
