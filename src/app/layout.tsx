import type { Metadata, Viewport } from 'next';
import { Hind_Siliguri, Tiro_Bangla } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { ServiceWorkerRegistration } from '@/components/service-worker';
import { ThemeProvider } from '@/components/theme-provider';
import { getPreferences } from '@/features/preferences/server';
import '@/styles/globals.css';

const hindSiliguri = Hind_Siliguri({
  weight: ['400', '500', '600', '700'],
  subsets: ['bengali', 'latin'],
  variable: '--font-hind-siliguri',
  display: 'swap',
});

const tiroBangla = Tiro_Bangla({
  weight: '400',
  subsets: ['bengali', 'latin'],
  variable: '--font-tiro-bangla',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  return {
    title: { default: t('name'), template: `%s · ${t('name')}` },
    description: t('tagline'),
    applicationName: 'Dhara',
    appleWebApp: { capable: true, title: t('name'), statusBarStyle: 'default' },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F4EF' },
    { media: '(prefers-color-scheme: dark)', color: '#121417' },
  ],
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const { locale } = await getPreferences();
  return (
    <html lang={locale} className={`${hindSiliguri.variable} ${tiroBangla.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
