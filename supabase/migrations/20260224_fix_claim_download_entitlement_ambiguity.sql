-- =============================================================================
-- Migration: 20260224_fix_claim_download_entitlement_ambiguity.sql
-- Description: 
--   1. Fixes column reference "entitlement_id" ambiguity in
--      claim_download_entitlement() by qualifying all table column references
--      with table aliases (c.entitlement_id).
--   2. Preserves customer download access for previously purchased assets,
--      even if an asset was subsequently marked inactive in digital_assets
--      (validates that the asset record exists and has a non-empty storage_path).
--   3. Casts v_asset.file_name and v_asset.mime_type to TEXT in all RETURN QUERY
--      SELECT statements to strictly match the declared RETURNS TABLE definition.
--   4. Retains all existing security invariants: verifies token hash,
--      rejects revoked entitlements, rejects expired tokens, enforces the
--      10-download quota limit, and guarantees atomic row-level reservation locks.
-- Target: Supabase PostgreSQL (Project ref: kqoqdxoicqxulefnruvn)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_download_entitlement(
    p_raw_token TEXT,
    p_idempotency_key TEXT
)
RETURNS TABLE (
    claim_id UUID,
    claim_token UUID,
    entitlement_id UUID,
    digital_asset_id UUID,
    storage_path TEXT,
    file_name TEXT,
    mime_type TEXT,
    status TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_token_hash CHAR(64);
    v_entitlement RECORD;
    v_existing_claim RECORD;
    v_asset RECORD;
    v_match_count INT;
    v_claim_id UUID;
    v_claim_token UUID;
    v_active_claims_count INT;
BEGIN
    IF p_raw_token IS NULL OR length(trim(p_raw_token)) = 0 OR p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENTS: Raw bearer token and idempotency key are required';
    END IF;

    -- Compute SHA-256 hash inside PostgreSQL
    v_token_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

    -- Exact match count validation
    SELECT COUNT(*) INTO v_match_count
    FROM public.download_entitlements e
    WHERE (e.token_hash = v_token_hash OR e.token = p_raw_token);

    IF v_match_count = 0 THEN
        RAISE EXCEPTION 'ENTITLEMENT_NOT_FOUND';
    ELSIF v_match_count > 1 THEN
        RAISE EXCEPTION 'SECURITY_ALERT: Ambiguous download credential detected';
    END IF;

    -- 1. Lock entitlement row FIRST (Consistent lock order: entitlement -> claim)
    SELECT * INTO v_entitlement
    FROM public.download_entitlements e
    WHERE (e.token_hash = v_token_hash OR e.token = p_raw_token)
    FOR UPDATE;

    IF v_entitlement.is_revoked THEN
        RAISE EXCEPTION 'ENTITLEMENT_REVOKED: %', COALESCE(v_entitlement.revocation_reason, 'revoked');
    END IF;

    IF NOT v_entitlement.is_active THEN
        RAISE EXCEPTION 'ENTITLEMENT_INACTIVE';
    END IF;

    IF v_entitlement.expires_at IS NOT NULL AND v_entitlement.expires_at < NOW() THEN
        RAISE EXCEPTION 'ENTITLEMENT_EXPIRED';
    END IF;

    -- Validate asset record exists and has a valid storage path.
    -- Existing purchases remain accessible even if the asset is subsequently retired/deactivated.
    SELECT * INTO v_asset FROM public.digital_assets a WHERE a.id = v_entitlement.digital_asset_id;
    IF NOT FOUND OR v_asset.storage_path IS NULL OR length(trim(v_asset.storage_path)) = 0 THEN
        RAISE EXCEPTION 'DIGITAL_ASSET_UNAVAILABLE';
    END IF;

    -- 2. Lock claim row SECOND (Qualify with table alias 'c' to prevent ambiguity with return column 'entitlement_id')
    SELECT * INTO v_existing_claim
    FROM public.download_claims c
    WHERE c.entitlement_id = v_entitlement.id AND c.idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
        -- Case A: Claim already finalized (url_issued)
        IF v_existing_claim.status = 'url_issued' THEN
            -- Reissuance strictly bounded to 60-second window
            IF v_existing_claim.finalized_at > (NOW() - INTERVAL '60 seconds') THEN
                RETURN QUERY SELECT v_existing_claim.id, v_existing_claim.claim_token, v_entitlement.id, v_asset.id, v_asset.storage_path::TEXT, v_asset.file_name::TEXT, v_asset.mime_type::TEXT, 'url_issued'::TEXT;
                RETURN;
            ELSE
                RAISE EXCEPTION 'IDEMPOTENCY_EXPIRED: Prior claim completed. Initiate a new download request.';
            END IF;
        END IF;

        -- Case B: Active unexpired reservation in flight
        IF v_existing_claim.status = 'claimed' AND v_existing_claim.expires_at > NOW() THEN
            RETURN QUERY SELECT v_existing_claim.id, v_existing_claim.claim_token, v_entitlement.id, v_asset.id, v_asset.storage_path::TEXT, v_asset.file_name::TEXT, v_asset.mime_type::TEXT, 'claimed'::TEXT;
            RETURN;
        END IF;

        -- Case C: Previous reservation expired or failed - Reactivate
        SELECT COUNT(*) INTO v_active_claims_count
        FROM public.download_claims c
        WHERE c.entitlement_id = v_entitlement.id 
          AND c.status = 'claimed' 
          AND c.expires_at > NOW()
          AND c.id != v_existing_claim.id;

        IF v_entitlement.download_limit IS NOT NULL 
           AND (v_entitlement.download_count + v_active_claims_count) >= v_entitlement.download_limit THEN
            RAISE EXCEPTION 'DOWNLOAD_LIMIT_REACHED';
        END IF;

        v_claim_token := extensions.gen_random_uuid();
        UPDATE public.download_claims
        SET status = 'claimed',
            claim_token = v_claim_token,
            failure_reason = NULL,
            expires_at = NOW() + INTERVAL '60 seconds',
            created_at = NOW(),
            finalized_at = NULL
        WHERE id = v_existing_claim.id;

        RETURN QUERY SELECT v_existing_claim.id, v_claim_token, v_entitlement.id, v_asset.id, v_asset.storage_path::TEXT, v_asset.file_name::TEXT, v_asset.mime_type::TEXT, 'claimed'::TEXT;
        RETURN;
    END IF;

    -- Fresh Claim: Calculate active reservation slots (Qualify with table alias 'c')
    SELECT COUNT(*) INTO v_active_claims_count
    FROM public.download_claims c
    WHERE c.entitlement_id = v_entitlement.id 
      AND c.status = 'claimed' 
      AND c.expires_at > NOW();

    IF v_entitlement.download_limit IS NOT NULL 
       AND (v_entitlement.download_count + v_active_claims_count) >= v_entitlement.download_limit THEN
        RAISE EXCEPTION 'DOWNLOAD_LIMIT_REACHED';
    END IF;

    -- Insert new reservation (download_count is NOT incremented here)
    v_claim_token := extensions.gen_random_uuid();
    INSERT INTO public.download_claims (
        entitlement_id, idempotency_key, claim_token, status, expires_at, created_at
    ) VALUES (
        v_entitlement.id, p_idempotency_key, v_claim_token, 'claimed', NOW() + INTERVAL '60 seconds', NOW()
    )
    RETURNING id INTO v_claim_id;

    RETURN QUERY SELECT v_claim_id, v_claim_token, v_entitlement.id, v_asset.id, v_asset.storage_path::TEXT, v_asset.file_name::TEXT, v_asset.mime_type::TEXT, 'claimed'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_download_entitlement(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_download_entitlement(TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
