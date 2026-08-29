import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata:Metadata={title:"Календарь дней рождения",description:"Все важные даты в одном красивом календаре.",manifest:"/manifest.webmanifest",appleWebApp:{capable:true,statusBarStyle:"black-translucent",title:"Дни рождения"},icons:{icon:"/birthday-icon.svg",apple:"/birthday-icon.svg"}};
export const viewport:Viewport={themeColor:"#10072b",width:"device-width",initialScale:1,viewportFit:"cover"};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ru"><body>{children}</body></html>}
