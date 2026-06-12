'use client'

import { useRenownAuth } from '@powerhousedao/reactor-browser'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { NavbarBrand } from './components/navbar-brand'
import NavbarItemMobile from './components/navbar-item-mobile'
import NavbarItemsDesk from './components/navbar-items-desk'
import NavbarRightSide from './components/navbar-right-side'
import { getNavbarConfig, PRIVATE_NAV_ITEMS, PUBLIC_NAV_ITEMS } from './navbar-config'

function AuthAwareNavItems({ pathname }: { pathname: string }) {
  const auth = useRenownAuth()
  const isUserRoute = pathname === '/user' || pathname.startsWith('/user/')
  const navItems =
    isUserRoute && auth.status === 'authorized' ? PRIVATE_NAV_ITEMS : PUBLIC_NAV_ITEMS
  return (
    <>
      <NavbarItemsDesk navItems={navItems} pathname={pathname} />
      <NavbarItemMobile navItems={navItems} pathname={pathname} />
    </>
  )
}

function Navbar() {
  const pathname = usePathname()

  const {
    isotype: Isotype,
    logotype: Logotype,
    logotypeClassName,
    logoHref,
  } = useMemo(() => getNavbarConfig(pathname), [pathname])

  return (
    <div className="border-border bg-background/80 fixed top-0 right-0 left-0 z-160 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <NavbarBrand
            isAchraPage={false}
            isotypeLogo={Isotype}
            logotype={Logotype}
            logotypeClassName={logotypeClassName}
            logoHref={logoHref}
          />
          <AuthAwareNavItems pathname={pathname} />
        </div>
        <NavbarRightSide />
      </div>
    </div>
  )
}

export default Navbar
