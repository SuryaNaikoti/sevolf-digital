const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
env.split('\n').forEach(l => {
  const idx = l.indexOf('=');
  if (idx > 0 && !l.startsWith('#')) envVars[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);
const baseUrl = 'http://localhost:3000';

(async () => {
  const results = [];
  function record(id, description, status, details = {}) {
    results.push({ id, description, status, details, timestamp: new Date().toISOString() });
    console.log(`[${status.toUpperCase()}] ${id}: ${description}`);
  }

  // Set up test admin and test customer
  const tempAdminEmail = `gap.admin.${Date.now()}@sevolf.test`;
  const tempCustEmail = `gap.customer.${Date.now()}@sevolf.test`;
  const tempPassword = 'TestPassword123!@#';

  const { data: adminUser } = await supabase.auth.admin.createUser({
    email: tempAdminEmail,
    password: tempPassword,
    email_confirm: true,
  });

  const { data: custUser } = await supabase.auth.admin.createUser({
    email: tempCustEmail,
    password: tempPassword,
    email_confirm: true,
  });

  // Assign admin role in public.profiles to admin user
  const { data: adminRole } = await supabase.from('roles').select('id').eq('name', 'admin').single();
  if (adminUser?.user?.id && adminRole?.id) {
    await supabase.from('profiles').update({ role_id: adminRole.id }).eq('id', adminUser.user.id);
  }

  const { data: adminAuth } = await supabase.auth.signInWithPassword({
    email: tempAdminEmail,
    password: tempPassword
  });

  const { data: custAuth } = await supabase.auth.signInWithPassword({
    email: tempCustEmail,
    password: tempPassword
  });

  const adminToken = adminAuth.session?.access_token;
  const custToken = custAuth.session?.access_token;

  console.log('Admin token ready:', !!adminToken);
  console.log('Cust token ready:', !!custToken);

  try {
    // -------------------------------------------------------------
    // PART 2: COUPON CONCURRENCY TESTS
    // -------------------------------------------------------------
    console.log('\n--- 2. Coupon Concurrency Tests ---');
    const testCode = `CONCUR${Date.now().toString().slice(-4)}`;
    const couponPayload = {
      code: testCode,
      discount_percent: 15,
      max_uses: 50
    };

    // Fire 2 simultaneous POST requests with identical coupon code
    const [cReq1, cReq2] = await Promise.all([
      fetch(baseUrl + '/api/admin/coupons', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(couponPayload)
      }),
      fetch(baseUrl + '/api/admin/coupons', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(couponPayload)
      })
    ]);

    const cStatus1 = cReq1.status;
    const cStatus2 = cReq2.status;
    const cData1 = await cReq1.json();
    const cData2 = await cReq2.json();

    const couponConcurrencyPass =
      (cStatus1 === 201 && cStatus2 === 409) ||
      (cStatus1 === 409 && cStatus2 === 201);

    // Verify DB count: exactly one record exists in public.coupons
    const checkSupabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);
    const { data: couponRows } = await checkSupabase.from('coupons').select('id, code').eq('code', testCode);
    const dbSingleRecord = couponRows?.length === 1;

    record(
      'coupon_concurrency_race',
      'Simultaneous creation of identical coupon code produces exactly one 201 and one 409',
      (couponConcurrencyPass && dbSingleRecord) ? 'pass' : 'fail',
      { cStatus1, cStatus2, cData1, cData2, dbRowCount: couponRows?.length }
    );

    // Clean up created coupon via service role (temporary test record)
    if (couponRows?.[0]?.id) {
      await supabase.from('coupons').delete().eq('id', couponRows[0].id);
    }

    // -------------------------------------------------------------
    // PART 3: CREDENTIAL AMBIGUITY TESTS
    // -------------------------------------------------------------
    console.log('\n--- 3. Credential Ambiguity Matrix Tests ---');

    // Case 3.1: Valid Cookie + Valid Bearer belonging to SAME user
    // In @supabase/ssr, the session is stored as a base64 encoded JSON string: "base64-" + Buffer.from(JSON.stringify(session)).toString('base64')
    const projectRef = envVars.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('.')[0];
    const cookieName = `sb-${projectRef}-auth-token`;
    const formatSsrCookie = (session) => 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64');
    const validAdminCookieValue = formatSsrCookie(adminAuth.session);

    const resSameUser = await fetch(baseUrl + '/api/admin/products', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Cookie': `${cookieName}=${validAdminCookieValue};`
      }
    });
    const sameUserData = await resSameUser.json();
    record(
      'credential_valid_cookie_valid_bearer_same_user',
      'Valid cookie + valid Bearer token for same user succeeds with 200 OK',
      resSameUser.status === 200 ? 'pass' : 'fail',
      { status: resSameUser.status }
    );

    // Case 3.2: Valid Cookie (Customer) + Valid Bearer (Admin) belonging to DIFFERENT users
    const validCustCookieValue = formatSsrCookie(custAuth.session);
    const resDiffUser = await fetch(baseUrl + '/api/admin/products', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Cookie': `${cookieName}=${validCustCookieValue};`
      }
    });
    const diffUserData = await resDiffUser.json();
    const isAmbiguous400 = resDiffUser.status === 400 && diffUserData.code === 'AMBIGUOUS_CREDENTIALS';
    record(
      'credential_valid_cookie_valid_bearer_different_users',
      'Valid cookie + valid Bearer token for different users rejected with 400 AMBIGUOUS_CREDENTIALS',
      isAmbiguous400 ? 'pass' : 'fail',
      { status: resDiffUser.status, data: diffUserData }
    );

    // Case 3.3: Valid Cookie (Admin) + Invalid Bearer token
    const resInvalidBearer = await fetch(baseUrl + '/api/admin/products', {
      headers: {
        'Authorization': 'Bearer invalid.bogus.jwt.token',
        'Cookie': `${cookieName}=${validAdminCookieValue};`
      }
    });
    const invalidBearerData = await resInvalidBearer.json();
    const isInvalidBearer401 = resInvalidBearer.status === 401 && invalidBearerData.code === 'INVALID_BEARER_TOKEN';
    record(
      'credential_valid_cookie_invalid_bearer',
      'Valid cookie + invalid Bearer token rejected with 401 INVALID_BEARER_TOKEN (fails closed on corrupted bearer)',
      isInvalidBearer401 ? 'pass' : 'fail',
      { status: resInvalidBearer.status, data: invalidBearerData }
    );

    // Case 3.4: Invalid Cookie + Valid Bearer (Admin)
    const resInvalidCookie = await fetch(baseUrl + '/api/admin/products', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Cookie': `${cookieName}=corrupted-garbage-cookie-value;`
      }
    });
    const invalidCookieData = await resInvalidCookie.json();
    // When cookie is invalid/unparseable, cookieUser is null, and valid Bearer resolves admin -> 200 OK
    record(
      'credential_invalid_cookie_valid_bearer',
      'Invalid cookie + valid Bearer token processes valid Bearer and succeeds with 200 OK',
      resInvalidCookie.status === 200 ? 'pass' : 'fail',
      { status: resInvalidCookie.status, data: invalidCookieData }
    );

    // -------------------------------------------------------------
    // PART 4: FULL ROUTE COVERAGE MATRIX (14 METHODS × 3 STATES)
    // -------------------------------------------------------------
    console.log('\n--- 4. Full Route Coverage Matrix (14 Methods) ---');
    const allMethods = [
      { id: 'm01', name: 'GET /api/admin/products', method: 'GET', path: '/api/admin/products' },
      { id: 'm02', name: 'POST /api/admin/products', method: 'POST', path: '/api/admin/products', body: { name: 'Probe', slug: 'probe' } },
      { id: 'm03', name: 'GET /api/admin/products/[slug]', method: 'GET', path: '/api/admin/products/14-day-home-reset-kit' },
      { id: 'm04', name: 'PATCH /api/admin/products/[slug]', method: 'PATCH', path: '/api/admin/products/14-day-home-reset-kit', body: { tagline: 'Probe' } },
      { id: 'm05', name: 'DELETE /api/admin/products/[slug]', method: 'DELETE', path: '/api/admin/products/non-existent-probe-slug' },
      { id: 'm06', name: 'GET /api/admin/collections', method: 'GET', path: '/api/admin/collections' },
      { id: 'm07', name: 'POST /api/admin/collections', method: 'POST', path: '/api/admin/collections', body: { name: 'Probe', slug: 'probe' } },
      { id: 'm08', name: 'PATCH /api/admin/collections', method: 'PATCH', path: '/api/admin/collections', body: { id: '00000000-0000-0000-0000-000000000001' } },
      { id: 'm09', name: 'GET /api/admin/coupons', method: 'GET', path: '/api/admin/coupons' },
      { id: 'm10', name: 'POST /api/admin/coupons', method: 'POST', path: '/api/admin/coupons', body: { code: 'PROBE', discount_percent: 10 } },
      { id: 'm11', name: 'PATCH /api/admin/coupons', method: 'PATCH', path: '/api/admin/coupons', body: { id: '00000000-0000-0000-0000-000000000001' } },
      { id: 'm12', name: 'GET /api/admin/assets', method: 'GET', path: '/api/admin/assets' },
      { id: 'm13', name: 'POST /api/admin/assets', method: 'POST', path: '/api/admin/assets', body: { file_name: 'probe.pdf', storage_path: 'products/probe.pdf' } },
      { id: 'm14', name: 'PATCH /api/admin/assets', method: 'PATCH', path: '/api/admin/assets', body: { id: '00000000-0000-0000-0000-000000000001' } },
    ];

    for (const m of allMethods) {
      // 1. Unauthenticated test (must be 401)
      const resUnauth = await fetch(baseUrl + m.path, {
        method: m.method,
        headers: m.body ? { 'Content-Type': 'application/json' } : {},
        body: m.body ? JSON.stringify(m.body) : undefined
      });
      const dataUnauth = await resUnauth.json();
      const passUnauth = resUnauth.status === 401 && dataUnauth.code === 'UNAUTHENTICATED';
      record(`coverage_unauth_${m.id}`, `${m.name} unauthenticated -> 401`, passUnauth ? 'pass' : 'fail', { status: resUnauth.status });

      // 2. Customer test (must be 403)
      const resCust = await fetch(baseUrl + m.path, {
        method: m.method,
        headers: {
          'Authorization': `Bearer ${custToken}`,
          ...(m.body ? { 'Content-Type': 'application/json' } : {})
        },
        body: m.body ? JSON.stringify(m.body) : undefined
      });
      const dataCust = await resCust.json();
      const passCust = resCust.status === 403 && dataCust.code === 'FORBIDDEN_INSUFFICIENT_ROLE';
      record(`coverage_cust_${m.id}`, `${m.name} customer -> 403`, passCust ? 'pass' : 'fail', { status: resCust.status });

      // 3. Admin test (must pass auth guard - status 200, 201, 400, or 404 validation, NEVER 401 or 403)
      const resAdmin = await fetch(baseUrl + m.path, {
        method: m.method,
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          ...(m.body ? { 'Content-Type': 'application/json' } : {})
        },
        body: m.body ? JSON.stringify(m.body) : undefined
      });
      const passAdmin = resAdmin.status !== 401 && resAdmin.status !== 403;
      record(`coverage_admin_${m.id}`, `${m.name} admin -> authorized (${resAdmin.status})`, passAdmin ? 'pass' : 'fail', { status: resAdmin.status });
    }

  } finally {
    // Clean up temporary test auth users
    if (adminUser?.user?.id) await supabase.auth.admin.deleteUser(adminUser.user.id);
    if (custUser?.user?.id) await supabase.auth.admin.deleteUser(custUser.user.id);
    console.log('\nTemporary test auth users cleaned up.');
  }

  fs.writeFileSync('SEVOLF_ADMIN_V16_FINAL_VERIFICATION/gap_closure_test_results.json', JSON.stringify(results, null, 2));
  console.log('\n=== Gap Closure Tests Completed ===');
  console.log(`Total tests run: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.status === 'pass').length}`);
  console.log(`Failed: ${results.filter(r => r.status === 'fail').length}`);
})();
