import { NextResponse } from 'next/server';

const SAMPLE_CSV = `name,description,category,price,compare_at_price,quantity,moq,status,featured,seo_title,seo_description,keywords,low_stock_threshold,preorder_shipping,images,variant_color,variant_color_hex,variant_size,variant_price,variant_stock
"Velvet Oud Eau de Parfum","Warm oud and amber with a soft rose heart. 100ml.","Perfumes",650.00,750.00,40,1,"Active",true,"Velvet Oud Eau de Parfum","Warm oud and amber perfume.","oud,amber,perfume",5,,"velvet-oud-front.jpg;velvet-oud-box.jpg",,,,,,
"Vanilla Musk Body Mist","Light vanilla and white musk body mist.","Body Mists",120.00,,,1,"Active",false,"Vanilla Musk Body Mist","Vanilla musk body mist.","body mist,vanilla",5,,"vanilla-musk.jpg",,,"100ml",120.00,60
"Vanilla Musk Body Mist","Light vanilla and white musk body mist.","Body Mists",120.00,,,1,"Active",false,"Vanilla Musk Body Mist","Vanilla musk body mist.","body mist,vanilla",5,,"vanilla-musk.jpg",,,"250ml",210.00,35
"Amber Glow Scented Candle (Wholesale Box)","Box of 12 amber and sandalwood candles.","Candles",900.00,,20,2,"Active",false,"Amber Glow Candle Wholesale","Wholesale amber candles.","candles,wholesale",3,,"amber-glow.jpg",,,,,,
`;

export async function GET() {
  return new NextResponse(SAMPLE_CSV, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="products-import-template.csv"',
    },
  });
}
