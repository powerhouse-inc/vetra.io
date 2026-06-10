'use client'

import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { NavbarBrand } from './components/navbar-brand'
import NavbarItemMobile from './components/navbar-item-mobile'
import NavbarItemsDesk from './components/navbar-items-desk'
import NavbarRightSide from './components/navbar-right-side'
import { getNavbarConfig } from './navbar-config'

function Navbar() {
  const pathname = usePathname()

  const {
    isotype: Isotype,
    logotype: Logotype,
    logotypeClassName,
    logoHref,
    navItems,
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
          <NavbarItemsDesk navItems={navItems} pathname={pathname} />
          <NavbarItemMobile navItems={navItems} pathname={pathname} />
        </div>
        <NavbarRightSide />
      </div>
    </div>
  )
}

export default Navbar
