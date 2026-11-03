import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'House of Elle - Elevate Your Style';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(140deg, #f7f2eb 0%, #efe4d4 55%, #f3eadf 100%)',
          color: '#16110d',
          position: 'relative',
          fontFamily: 'serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 36,
            left: 50,
            right: 50,
            height: 1,
            background: 'rgba(200,155,60,0.45)',
          }}
        />
        <img
          src={`${process.env.NEXT_PUBLIC_APP_URL || 'https://example.com'}/house-of-elle-logo.png`}
          alt="House of Elle"
          width={380}
          height={170}
          style={{ objectFit: 'contain', marginBottom: 24 }}
        />
        <div style={{ fontSize: 70, fontWeight: 600, letterSpacing: '-0.02em' }}>Elevate Your Style</div>
        <div style={{ fontSize: 34, marginTop: 16, color: '#6b4f2c' }}>Perfumes, Body Mists & Candles · Accra</div>
      </div>
    ),
    {
      ...size,
    }
  );
}
