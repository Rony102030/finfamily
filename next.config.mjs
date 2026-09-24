import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    // Fundos, Conf. Fundos, Emergência e Metas viraram Caixinhas
    async redirects() {
        return [
            { source: '/fundos', destination: '/caixinhas', permanent: false },
            { source: '/fundos/:path*', destination: '/caixinhas', permanent: false },
            { source: '/metas', destination: '/caixinhas', permanent: false },
        ];
    },
};

export default withPWA(nextConfig);
