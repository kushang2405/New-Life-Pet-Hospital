import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { SettingsProvider } from './components/settings-provider';
import PwaRegister from './components/pwa-register';

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-plus-jakarta' });

export const metadata: Metadata = {
  title: 'New Life Pet Hospital',
  description:
    'New Life Pet Hospital, Surat, Gujarat. Patient records, appointments, billing and staff attendance in one place.',

  robots: { index: true, follow: true },

  openGraph: {
    title: 'New Life Pet Hospital',
    description:
      'New Life Pet Hospital, Surat, Gujarat. Patient records, appointments, billing and staff attendance in one place.',
    siteName: 'New Life Pet Hospital',
    locale: 'en_IN',
    type: 'website',
  },

  twitter: {
    card: 'summary',
    title: 'New Life Pet Hospital',
    description:
      'New Life Pet Hospital, Surat, Gujarat. Patient records, appointments, billing and staff attendance in one place.',
  },

  manifest: '/manifest.json',
  category: 'medical',

  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
  },

  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'New Life Pet Hospital',
  },
};

export const viewport: Viewport = {
  themeColor: '#4C1D95',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/*
          Apply the saved theme before first paint. Without this the page
          renders with the default violet palette for a frame and then
          snaps to the user's chosen colour / dark mode.
          Kept in sync with themeVarsFor() in app/lib/settings.ts.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
var s=JSON.parse(localStorage.getItem('petcare-pro-settings')||'{}');
var hex=(s.primaryColor||'#4C1D95').replace('#','');
if(hex.length!==6)hex='4C1D95';
var base=[parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)];
function mix(c,a){var t=a>0?255:0,k=Math.abs(a);return c.map(function(v){return Math.round(v+(t-v)*k)});}
function lum(c){var f=function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]);}
var th=s.theme||'light';
if(th==='auto')th=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
var d=document.documentElement,dark=th==='dark';
if(th==='light'||dark){
var acc=base;
if(dark){for(var i=0;i<10&&lum(acc)<0.35;i++)acc=mix(acc,0.1);}
d.style.setProperty('--c-plum',acc.join(' '));
d.style.setProperty('--c-grape',mix(acc,dark?0.16:-0.38).join(' '));
d.style.setProperty('--c-iris',mix(acc,0.26).join(' '));
d.style.setProperty('--c-lilac',mix(acc,dark?-0.78:0.88).join(' '));
}
d.style.setProperty('--c-ink',dark?'237 233 254':'26 13 46');
d.style.setProperty('--c-canvas',dark?'20 12 33':'250 249 253');
d.style.setProperty('--c-line',dark?'54 38 82':'232 227 243');
d.style.setProperty('--c-surface',dark?'30 20 48':'255 255 255');
d.style.setProperty('--app-font-size',{small:'14px',medium:'16px',large:'18px'}[s.fontSize||'medium']||'16px');
d.dataset.theme=th;d.style.colorScheme=dark?'dark':'light';
}catch(e){}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'New Life Pet Hospital',
              description: 'Pet hospital in Surat, Gujarat.',
              address: {
                '@type': 'PostalAddress',
                streetAddress: 'Opp. Amisha hotel, Between Delhigate & Lal Darwaja, Una Pani Road, Near Railway Station',
                addressLocality: 'Surat',
                addressRegion: 'Gujarat',
                addressCountry: 'IN',
              },
            }),
          }}
        />
      </head>
      <body className={plusJakarta.variable}>
        <SettingsProvider><PwaRegister />{children}</SettingsProvider>
      </body>
    </html>
  );
}
