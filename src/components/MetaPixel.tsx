"use client";

import Script from "next/script";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

declare global {
  interface Window {
    __palmcosmicFbqPageViewGuardInstalled?: boolean;
    __palmcosmicTrackedPageViewKeys?: Record<string, boolean>;
  }
}

export const MetaPixel = () => {
  if (!PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel-init" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          (function() {
            if (window.__palmcosmicFbqPageViewGuardInstalled) return;
            window.__palmcosmicFbqPageViewGuardInstalled = true;
            window.__palmcosmicTrackedPageViewKeys = window.__palmcosmicTrackedPageViewKeys || {};
            var originalFbq = window.fbq;
            window.fbq = function() {
              try {
                var args = Array.prototype.slice.call(arguments);
                var isPageView = args[0] === 'track' && args[1] === 'PageView';
                if (isPageView) {
                  var params = args[2] || {};
                  var routeKey = String(params.page_path || window.location.pathname || '/') + '?' + String(window.location.search || '');
                  if (window.__palmcosmicTrackedPageViewKeys[routeKey]) return;
                  window.__palmcosmicTrackedPageViewKeys[routeKey] = true;
                }
              } catch (error) {}
              return originalFbq.apply(this, arguments);
            };
            for (var key in originalFbq) {
              try { window.fbq[key] = originalFbq[key]; } catch (error) {}
            }
          })();
          fbq('track', 'PageView', {
            page_path: window.location.pathname || '/',
            page_location: window.location.href
          });
        `}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
};
