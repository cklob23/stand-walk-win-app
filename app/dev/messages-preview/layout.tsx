import { notFound } from 'next/navigation'
import Script from 'next/script'

export default function MessagesPreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }
  return (
    <>
      <Script id="messages-preview-theme" strategy="beforeInteractive">
        {`(function(){try{var t=new URLSearchParams(window.location.search).get('theme');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark'}else if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.style.colorScheme='light'}}catch(e){}})();`}
      </Script>
      {children}
    </>
  )
}
