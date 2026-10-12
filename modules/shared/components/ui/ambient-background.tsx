/**
 * Site-wide ambient backdrop. Mounted once at app/layout.tsx, sits
 * behind everything via fixed -z-10. Pure CSS, no JS.
 *
 *  - 3 large blurred radial blobs at low opacity, anchored at viewport
 *    corners, providing soft pools of brand colour.
 *  - Low-opacity SVG noise tile to break banding and add film grain.
 *
 * Pages that paint their own background (e.g. the console landing pages) layer
 * naturally above this. Pointer-events disabled so it never intercepts
 * clicks.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* radial blobs — primary brand color at low opacity */}
      <div className="bg-primary absolute -top-[20%] -right-[10%] h-[60vh] w-[60vh] rounded-full opacity-[0.06] blur-3xl dark:opacity-[0.08]" />
      <div className="bg-primary absolute -bottom-[20%] -left-[10%] h-[55vh] w-[55vh] rounded-full opacity-[0.05] blur-3xl dark:opacity-[0.07]" />
      <div className="bg-primary absolute top-[30%] left-[40%] h-[50vh] w-[50vh] -translate-x-1/2 rounded-full opacity-[0.03] blur-3xl dark:opacity-[0.05]" />

      {/* film grain — fixed-size SVG noise tile, repeats. Kills banding
          on dark gradients and adds a touch of texture. */}
      <div
        className="absolute inset-0 opacity-[0.025] mix-blend-overlay dark:opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          backgroundSize: '160px 160px',
        }}
      />
    </div>
  )
}
