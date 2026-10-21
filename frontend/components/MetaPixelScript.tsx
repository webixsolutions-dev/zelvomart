import Script from "next/script";
import {storefrontHosts} from '@/lib/site-url';

export default function MetaPixelScript({ pixelId }: { pixelId?: string }) {
  if (!pixelId||!/^\d+$/.test(pixelId)) return null;
  return (
    <>
      <Script id="meta-pixel" strategy="lazyOnload">
        {`if(${JSON.stringify(storefrontHosts())}.includes(location.hostname)&&!location.pathname.startsWith('/admin')&&!localStorage.getItem('zelvomart_admin_user')&&!localStorage.getItem('zelvomart_admin_token')&&localStorage.getItem('zm_session_replay_opt_out')!=='1'){!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');}`}
      </Script>

    </>
  );
}
