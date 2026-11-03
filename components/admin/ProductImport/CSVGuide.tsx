'use client';

import { useState } from 'react';

export default function CSVGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <span>CSV column specification and format guide</span>
        <i className={`ri-arrow-${open ? 'up' : 'down'}-s-line text-lg text-gray-500`} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 text-sm text-gray-600 space-y-3 border-t border-gray-200">
          <p className="pt-3">
            <strong>Required columns:</strong> name, price (in GH₵). SKU and slug are auto-generated.
          </p>
          <p>
            <strong>Optional:</strong> description (plain text, ~500 chars), category (must match an active category),
            compare_at_price (must be higher than price), quantity, moq, status (Active / Draft / Archived),
            featured (true/false), seo_title, seo_description, keywords (comma-separated → tags),
            low_stock_threshold, preorder_shipping, images (semicolon-separated filenames in images/ folder).
          </p>
          <p>
            <strong>Variants (Scent / Colour × Size):</strong> Repeat the product on multiple rows with the same name and set
            variant_color (the scent or colour, e.g. Vanilla, Rose, Oud), variant_color_hex (optional swatch, e.g. #F3E5AB),
            variant_size (e.g. 50ml, 100ml, Gift Set), variant_price, variant_stock.
            Common colour names (e.g. Black, White, Red) get a swatch colour auto-filled if variant_color_hex is omitted.
          </p>
          <p>
            <strong>ZIP structure:</strong> Place products.csv at the root and put images in an images/ folder.
            Reference filenames in the images column (e.g. bottle.jpg;box.jpg). Images can be JPG, PNG, WebP or GIF (up to 10 MB each).
          </p>
        </div>
      )}
    </div>
  );
}
