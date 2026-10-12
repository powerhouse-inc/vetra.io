/**
 * Unit-test stand-in for `next/font/google`, which only works inside the Next
 * compiler. Every font loader returns a stable class/variable pair.
 */
type FontOptions = { variable?: string }

function loader(options: FontOptions = {}) {
  return { className: 'font-stub', variable: options.variable ?? '', style: { fontFamily: 'stub' } }
}

export const Geist = loader
export const JetBrains_Mono = loader
export const Inter = loader
