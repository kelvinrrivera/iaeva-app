'use client';

import Script from 'next/script';
import { useEffect } from 'react';

declare global {
    interface Window {
        fbAsyncInit: () => void;
        FB: any;
    }
}

export default function FacebookSDKScript() {
    useEffect(() => {
        window.fbAsyncInit = function () {
            window.FB.init({
                appId: process.env.NEXT_PUBLIC_APP_ID,
                cookie: true,
                xfbml: true,
                version: 'v22.0'
            });
        };
    }, []);

    return (
        <Script
            async
            defer
            crossOrigin="anonymous"
            src="https://connect.facebook.net/en_US/sdk.js"
            id="facebook-jssdk"
        />
    );
}
