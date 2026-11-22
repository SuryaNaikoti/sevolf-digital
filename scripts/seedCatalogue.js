/**
 * SEVOLF DIGITAL — LAUNCH CATALOGUE SEED SCRIPT (PRODUCTION-READY EDITION)
 *
 * SCOPE & INTEGRITY RULES:
 * 1. Seeds exactly the two verified launch products and their verified master assets:
 *    - Product 1: "14-Day Home Reset Kit" (1 product, 2 digital_assets: A4 & US Letter, v1.2.3)
 *    - Product 2: "Mitthu's Fun Learning Book" (1 product, 1 digital_asset: A4 50-pages, v1.0.0, Ages 2-3)
 * 2. Status: strictly 'draft' for both products.
 * 3. PRICING EXCLUDED: product_prices inserts/updates are strictly omitted pending commercial approval.
 * 4. Storage path: exact bucket-relative object keys in 'digital-products'.
 *    Preserves existing Storage objects without upload, delete, rename, or overwrite.
 * 5. Idempotent digital_assets logic:
 *    Matches existing digital_assets by (product_id, storage_path) to safely update metadata
 *    or insert when absent, ensuring zero duplicate rows upon repeated execution.
 * 6. Dry-run mode by default. Requires '--execute' to perform database modification.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local securely
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Fatal: .env.local file not found.');
  process.exit(1);
}

const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
const env = {};
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
}

const BUCKET_NAME = 'digital-products';
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const VERIFIED_LAUNCH_CATALOGUE = [
  // ============================================================================
  // PRODUCT 1: 14-DAY HOME RESET KIT (HOME & LIVING)
  // ============================================================================
  {
    slug: '14-day-home-reset-kit',
    name: '14-Day Home Reset Kit',
    tagline: 'A restorative step-by-step system for reclaiming serenity in your home.',
    short_description: 'An intentional 22-page editorial workbook and daily room-by-room audit system to declutter and refresh your living environment. Includes both A4 and US Letter editions.',
    full_description: `The 14-Day Home Reset Kit is designed for individuals seeking intentional order in their physical surroundings without the stress of overwhelming overhauls.

Structured into fourteen distinct daily sequences, the guide walks you through entryway curation, kitchen functional zones, wardrobe moderation, and quiet evening retreats. Each day contains a concise intentionality essay, an actionable checklist, and storage layout diagrams.

Includes both international A4 and North American US Letter standard printable editions, calibrated with binder margins for physical printing or tablet annotation.`,
    category_slug: 'home-living',
    collection_slug: 'home-living',
    product_type: 'Comprehensive Guide & Workbook',
    format: 'pdf',
    format_label: 'Downloadable PDF (A4 & US Letter Editions)',
    cover_image_url: '/images/products/home-reset-kit/cover.jpg',
    licence_type: 'personal',
    licence_description: 'Single-household personal licence. For personal use only. Redistribution or commercial resale is strictly prohibited.',
    status: 'draft', // Strictly DRAFT
    is_featured: true,
    is_new_arrival: false,
    is_bestseller: true,
    is_bundle: false,
    tags: ['home', 'declutter', 'organisation', 'minimalism', 'lifestyle'],
    seo_title: '14-Day Home Reset Kit | SEVOLF Digital Home & Living',
    seo_description: 'An intentional 22-page digital guide and workbook to declutter and organize your living spaces. Includes A4 & US Letter printable editions.',
    key_benefits: [
      'Manageable 30 to 60-minute daily micro-interventions.',
      'Includes calibrated A4 and US Letter editions with 20mm binder margins.',
      'Sustainable seasonal framework based on the 30-Day Pause Box method.'
    ],
    educational_meta: null,
    specifications: {
      'Page Count': '22 Pages per Edition',
      'Editions Included': 'A4 (210 × 297 mm) and US Letter (8.5 × 11 in)',
      'Total File Size': '12.24 MB combined',
      'Version': 'v1.2.3 (Edition No. 04)'
    },
    media: [
      { url: '/images/products/home-reset-kit/cover.jpg', media_type: 'cover', alt_text: '14-Day Home Reset Kit Cover Artwork', display_order: 1 },
      { url: '/images/products/home-reset-kit/interior-1.jpg', media_type: 'gallery', alt_text: 'Daily Room Reset Routine Layout', display_order: 2 },
      { url: '/images/products/home-reset-kit/interior-2.jpg', media_type: 'gallery', alt_text: 'Pantry and Storage Organization Matrix', display_order: 3 },
      { url: '/images/products/home-reset-kit/spotlight-mockup.jpg', media_type: 'mockup', alt_text: 'Tablet & Print Editions Mockup Display', display_order: 4 }
    ],
    // DUAL MASTER ASSETS ASSOCIATED WITH SINGLE PRODUCT
    digital_assets: [
      {
        storage_path: 'products/14-day-home-reset-kit/v1.2.3/Home-Reset-Kit-A4.pdf',
        file_name: 'Home-Reset-Kit-A4.pdf',
        file_size_bytes: 6449010,
        mime_type: 'application/pdf',
        file_version: 'v1.2.3',
        checksum: 'f9db4c8b325e59aa023f4360b0bd7ea2337ae0f287646ebdc3b522f86233dcec'
      },
      {
        storage_path: 'products/14-day-home-reset-kit/v1.2.3/Home-Reset-Kit-US-Letter.pdf',
        file_name: 'Home-Reset-Kit-US-Letter.pdf',
        file_size_bytes: 6383636,
        mime_type: 'application/pdf',
        file_version: 'v1.2.3',
        checksum: 'b6bcc0a9bf276192923763b5a4b7a06195b78f9f2b182b1bed67c299bddfdb8b'
      }
    ]
  },

  // ============================================================================
  // PRODUCT 2: MITTHU'S FUN LEARNING BOOK (SEVOLF LITTLE)
  // ============================================================================
  {
    slug: 'mitthus-fun-learning-book',
    name: "Mitthu's Fun Learning Book",
    tagline: 'Early literacy, phonics, and curiosity activities for toddler discovery.',
    short_description: 'An authentic 50-page printable A4 activity workbook designed for early learning (ages 2–3), combining foundational tracing with gentle bilingual cues.',
    full_description: `Crafted with gentle earth tones and purposeful illustrations, Mitthu's Fun Learning Book introduces young toddlers to foundational motor control and observation without sensory overload.

Spanning 50 structured A4 pages, the book guides children through tactile line tracing, object association, and early vocabulary in a calm, screen-free format.`,
    category_slug: 'kids-education',
    collection_slug: 'kids-education',
    product_type: 'Printable Activity Workbook',
    format: 'pdf',
    format_label: 'Printable A4 PDF Activity Book',
    cover_image_url: '/images/products/mitthus-fun-learning/cover.jpg',
    licence_type: 'personal',
    licence_description: 'Personal household licence. Unlimited personal prints for children in your home.',
    status: 'draft', // Strictly DRAFT
    is_featured: true,
    is_new_arrival: false,
    is_bestseller: true,
    is_bundle: false,
    tags: ['kids', 'learning', 'phonics', 'montessori', 'activity book', 'toddler'],
    seo_title: "Mitthu's Fun Learning Book | SEVOLF Little Education",
    seo_description: 'Gentle 50-page early learning activity workbook for ages 2–3. Phonics, tracing, and nature counting without screen time.',
    key_benefits: [
      'Authentic 50-page tactile activity sequence.',
      'Calibrated specifically for ages 2–3 early childhood development.',
      'Zero sensory overload or screen fatigue.'
    ],
    educational_meta: {
      ageRange: '2 – 3 Years',
      learningObjectives: [
        'Early pencil grip and pre-writing motor control',
        'Basic shape and object recognition',
        'Gentle bilingual vocabulary elements'
      ],
      pagesIncluded: 50,
      language: 'English with Hindi vocabulary cues',
      printingInstructions: 'Standard A4 paper (80–100 gsm recommended)'
    },
    specifications: {
      'Target Age': '2 to 3 Years',
      'Format': 'Standard A4 PDF (595 × 842 pt)',
      'Page Count': '50 Pages',
      'File Size': '615.8 KB',
      'Version': 'v1.0.0'
    },
    media: [
      { url: '/images/products/mitthus-fun-learning/cover.jpg', media_type: 'cover', alt_text: "Mitthu's Fun Learning Book Cover", display_order: 1 },
      { url: '/images/products/mitthus-fun-learning/sample-pages.jpg', media_type: 'gallery', alt_text: 'Sample Phonics and Line Tracing Exercises', display_order: 2 },
      { url: '/images/products/mitthus-fun-learning/flashcards.jpg', media_type: 'gallery', alt_text: 'Printable Activity Cards', display_order: 3 }
    ],
    // SINGLE MASTER ASSET ASSOCIATED WITH MITTHU
    digital_assets: [
      {
        storage_path: 'products/mitthus-fun-learning-book/v1.0.0/Fun-Learning-Book.pdf',
        file_name: 'Fun-Learning-Book.pdf',
        file_size_bytes: 615857,
        mime_type: 'application/pdf',
        file_version: 'v1.0.0',
        checksum: '6e4edf31ed0511a01da5389196c9f2b76467ca84edab8e454d052a6d1c37a2f6'
      }
    ]
  }
];

/**
 * Pre-Execution Verification: Confirms every storage_path physically exists in 'digital-products' bucket.
 * Purely read-only inspection. Never uploads, deletes, renames, or overwrites any storage object.
 */
async function verifyStoragePreconditions() {
  console.log('--- STORAGE PRECONDITION CHECK ---');
  for (const product of VERIFIED_LAUNCH_CATALOGUE) {
    for (const asset of product.digital_assets) {
      const lastSlash = asset.storage_path.lastIndexOf('/');
      const folder = asset.storage_path.slice(0, lastSlash);
      const filename = asset.storage_path.slice(lastSlash + 1);

      const { data: files, error } = await supabase.storage.from(BUCKET_NAME).list(folder);
      if (error) {
        throw new Error(`Failed to access storage folder "${folder}": ${error.message}`);
      }
      const match = files?.find(f => f.name === filename);
      if (!match) {
        throw new Error(`CRITICAL: Object "${asset.storage_path}" NOT FOUND in bucket "${BUCKET_NAME}".`);
      }
      if (match.metadata?.size !== asset.file_size_bytes) {
        throw new Error(`Size mismatch for "${asset.storage_path}": Storage has ${match.metadata?.size}, expected ${asset.file_size_bytes}`);
      }
      console.log(`[VERIFIED IN STORAGE] ${asset.storage_path} (${match.metadata.size} bytes)`);
    }
  }
  console.log('--- STORAGE PRECONDITIONS 100% SATISFIED (ALL OBJECTS UNTOUCHED) ---\n');
}

async function runSeed(execute = false) {
  console.log('================================================================');
  console.log('SEVOLF DIGITAL — LAUNCH CATALOGUE SEED AUDIT');
  console.log(`Mode: ${execute ? 'EXECUTION (LIVE DATABASE INSERT)' : 'DRY RUN (NO MODIFICATIONS)'}`);
  console.log('================================================================\n');

  // Verify storage integrity before touching database
  await verifyStoragePreconditions();

  // Fetch Category and Collection IDs
  const { data: categories, error: catErr } = await supabase.from('product_categories').select('id, slug');
  if (catErr || !categories) throw new Error(`Category lookup failed: ${catErr?.message}`);
  const categoryMap = new Map(categories.map(c => [c.slug, c.id]));

  const { data: collections, error: colErr } = await supabase.from('product_collections').select('id, slug');
  if (colErr || !collections) throw new Error(`Collection lookup failed: ${colErr?.message}`);
  const collectionMap = new Map(collections.map(c => [c.slug, c.id]));

  for (const item of VERIFIED_LAUNCH_CATALOGUE) {
    const categoryId = categoryMap.get(item.category_slug);
    const collectionId = collectionMap.get(item.collection_slug);

    if (!categoryId) throw new Error(`Category "${item.category_slug}" does not exist in database.`);
    if (!collectionId) throw new Error(`Collection "${item.collection_slug}" does not exist in database.`);

    console.log(`[PROPOSED PRODUCT] ${item.name} (${item.slug})`);
    console.log(`  - Category ID: ${categoryId} (${item.category_slug})`);
    console.log(`  - Collection ID: ${collectionId} (${item.collection_slug})`);
    console.log(`  - Format: ${item.format} | Status: ${item.status}`);
    console.log(`  - Pricing: EXCLUDED (Pending commercial approval - zero price rows inserted)`);
    console.log(`  - Digital Assets Count: ${item.digital_assets.length}`);
    item.digital_assets.forEach(a => {
      console.log(`    * ${a.file_name} -> Path: ${a.storage_path} (${(a.file_size_bytes / 1024 / 1024).toFixed(2)} MB, Version: ${a.file_version})`);
    });
    console.log(`  - Media Records: ${item.media.length} items`);

    if (execute) {
      // 1. Upsert Product
      const productPayload = {
        name: item.name,
        slug: item.slug,
        tagline: item.tagline,
        short_description: item.short_description,
        full_description: item.full_description,
        category_id: categoryId,
        product_type: item.product_type,
        format: item.format,
        format_label: item.format_label,
        cover_image_url: item.cover_image_url,
        licence_type: item.licence_type,
        licence_description: item.licence_description,
        status: 'draft', // Strictly DRAFT
        is_featured: item.is_featured,
        is_new_arrival: item.is_new_arrival,
        is_bestseller: item.is_bestseller,
        is_bundle: item.is_bundle,
        tags: item.tags,
        seo_title: item.seo_title,
        seo_description: item.seo_description,
        key_benefits: item.key_benefits,
        specifications: item.specifications,
        educational_meta: item.educational_meta,
        updated_at: new Date().toISOString()
      };

      const { data: prodRow, error: pErr } = await supabase
        .from('products')
        .upsert(productPayload, { onConflict: 'slug' })
        .select('id, slug, name')
        .single();

      if (pErr) throw new Error(`Product upsert failed for ${item.slug}: ${pErr.message}`);
      const productId = prodRow.id;

      // 2. Upsert Collection Product Junction (Unique by collection_id, product_id)
      const { error: colProdErr } = await supabase
        .from('collection_products')
        .upsert({ collection_id: collectionId, product_id: productId, display_order: 1 }, { onConflict: 'collection_id,product_id' });
      if (colProdErr) throw new Error(`Collection junction failed for ${item.slug}: ${colProdErr.message}`);

      // 3. Media: Idempotent reconciliation
      // Clean and re-insert media records specifically for this product
      const { error: medDelErr } = await supabase.from('product_media').delete().eq('product_id', productId);
      if (medDelErr) throw new Error(`Media cleanup failed for ${item.slug}: ${medDelErr.message}`);

      const mediaPayload = item.media.map(m => ({
        product_id: productId,
        url: m.url,
        media_type: m.media_type,
        alt_text: m.alt_text,
        display_order: m.display_order
      }));
      const { error: medInsErr } = await supabase.from('product_media').insert(mediaPayload);
      if (medInsErr) throw new Error(`Media insertion failed for ${item.slug}: ${medInsErr.message}`);

      // 4. Prices: EXCLUDED.
      // Deliberately omitted per mandate: commercial pricing is unapproved.

      // 5. Digital Assets: Idempotent matching by (product_id, storage_path)
      // Query existing digital_assets for this product to prevent duplicate rows on re-runs
      const { data: existingAssets, error: astFetchErr } = await supabase
        .from('digital_assets')
        .select('id, storage_path')
        .eq('product_id', productId);
      if (astFetchErr) throw new Error(`Digital asset lookup failed for ${item.slug}: ${astFetchErr.message}`);

      const existingMap = new Map((existingAssets || []).map(a => [a.storage_path, a.id]));

      for (const a of item.digital_assets) {
        const assetData = {
          product_id: productId,
          storage_path: a.storage_path,
          file_name: a.file_name,
          file_size_bytes: a.file_size_bytes,
          mime_type: a.mime_type,
          file_version: a.file_version,
          checksum: a.checksum
        };

        if (existingMap.has(a.storage_path)) {
          // Update existing asset record
          const existingId = existingMap.get(a.storage_path);
          const { error: updateErr } = await supabase
            .from('digital_assets')
            .update(assetData)
            .eq('id', existingId);
          if (updateErr) throw new Error(`Failed to update digital_asset ${a.storage_path}: ${updateErr.message}`);
          console.log(`    [ASSET RECONCILED - UPDATED] ${a.file_name} (ID: ${existingId})`);
        } else {
          // Insert new asset record
          const { data: insertedAsset, error: insertErr } = await supabase
            .from('digital_assets')
            .insert(assetData)
            .select('id')
            .single();
          if (insertErr) throw new Error(`Failed to insert digital_asset ${a.storage_path}: ${insertErr.message}`);
          console.log(`    [ASSET RECONCILED - INSERTED] ${a.file_name} (ID: ${insertedAsset.id})`);
        }
      }

      console.log(`  -> [SUCCESS] Database records created/updated for ${item.name} (ID: ${productId})\n`);
    } else {
      console.log('  -> [DRY-RUN] Verified valid. No database modification made.\n');
    }
  }

  console.log('================================================================');
  if (execute) {
    console.log('SEEDING COMPLETE: All records successfully created in DRAFT status.');
    console.log('Pricing was strictly omitted. Storage objects preserved.');
  } else {
    console.log('DRY RUN COMPLETE: Pre-conditions verified. Awaiting explicit execution approval.');
  }
  console.log('================================================================');
}

module.exports = {
  VERIFIED_LAUNCH_CATALOGUE,
  runSeed
};

if (require.main === module) {
  const isExecute = process.argv.includes('--execute');
  runSeed(isExecute).catch(err => {
    console.error('Fatal error during seed preview/execution:', err);
    process.exit(1);
  });
}
